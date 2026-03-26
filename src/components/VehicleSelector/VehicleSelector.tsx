import { useState, useEffect, useRef } from 'react';
import type { Configuration, Vehicle, VehicleConfigureMode } from '../../types';
import { makes, modelsByMake, years, vehicles } from '../../data/vehicles';
import {
  cleanupVehiclesFolderImages,
  isCloudinaryConfigured,
  uploadImageFile,
} from '../../services/cloudinary';

import type { LogEntry } from '../LogBox/LogBox';

const USER_UPLOAD_VEHICLE_ID = 'user-uploaded-vehicle';

interface Props {
  config: Configuration;
  setConfig: (c: Configuration) => void;
  onNext: () => void;
  addLog: (type: LogEntry['type'], message: string, details?: string) => void;
  showToast: (message: string) => void;
}

export default function VehicleSelector({ config, setConfig, onNext, addLog, showToast }: Props) {
  const mode = config.vehicleConfigureMode;
  const [make, setMake] = useState(config.vehicle?.make || '');
  const [model, setModel] = useState(config.vehicle?.model || '');
  const [year, setYear] = useState(config.vehicle?.year || '');
  const [uploadingBase, setUploadingBase] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const mountedRef = useRef(true);
  const baseUploadSessionRef = useRef(0);
  const changeBaseFileInputRef = useRef<HTMLInputElement | null>(null);
  const onNextRef = useRef(onNext);
  const redirectTimeoutsRef = useRef<number[]>([]);

  function clearRedirectTimersOnly() {
    redirectTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    redirectTimeoutsRef.current = [];
  }

  function startRedirectCountdown() {
    // Cancel any existing scheduled redirects and start a fresh chain.
    clearRedirectTimersOnly();
    setRedirectCountdown(4);
    addLog('action', 'Auto-redirect countdown started (upload)');

    const t1 = window.setTimeout(() => setRedirectCountdown(3), 1000);
    const t2 = window.setTimeout(() => setRedirectCountdown(2), 2000);
    const t3 = window.setTimeout(() => setRedirectCountdown(1), 3000);
    const t4 = window.setTimeout(() => {
      setRedirectCountdown(null);
      addLog('action', 'Auto-redirecting to accessories now');
      onNextRef.current();
    }, 4000);

    redirectTimeoutsRef.current = [t1, t2, t3, t4];
  }

  function stopRedirect() {
    clearRedirectTimersOnly();
    setRedirectCountdown(null);
  }

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // If we leave image-mode, stop any pending redirect UI/timers.
  useEffect(() => {
    if (mode !== 'images') {
      setRedirectCountdown(null);
      setUploadingBase(false);
      // Invalidate any in-flight upload so it can't re-apply UI/state later.
      baseUploadSessionRef.current += 1;
    } else {
      // Entering images mode: ensure we aren't showing a stale uploading state.
      setUploadingBase(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!config.vehicle) return;
    if (config.vehicle.id === USER_UPLOAD_VEHICLE_ID) {
      setMake(config.vehicle.make);
      setModel(config.vehicle.model);
      setYear(config.vehicle.year);
      return;
    }
    if (mode === 'data') {
      setMake(config.vehicle.make);
      setModel(config.vehicle.model);
      setYear(config.vehicle.year);
    }
  }, [config.vehicle?.id, mode]);

  const filteredVehicles = vehicles.filter(v =>
    (!make || v.make === make) &&
    (!model || v.model === model) &&
    (!year || v.year === year)
  );

  function switchMode(next: VehicleConfigureMode) {
    if (next === mode) return;

    // If switching from image-mode back to data-mode, clear everything Cloudinary uploaded
    // into the `Vehicles/` folder. Fire-and-forget (do not block the UI).
    if (next === 'data' && mode === 'images') {
      showToast('Cleaning Cloudinary Vehicles images…');
      addLog('action', 'Starting Cloudinary cleanup for Vehicles/ folder');
      const cleanup = cleanupVehiclesFolderImages()
        .catch((e: unknown) => {
          console.error(e);
          addLog(
            'error',
            'Cloudinary cleanup failed',
            e instanceof Error ? e.message : 'Unknown error'
          );
        });
      void cleanup;
    }

    addLog('action', `Vehicle step: switched to ${next === 'data' ? 'configure by data' : 'configure with images'}`);
    setConfig({
      ...config,
      vehicleConfigureMode: next,
      vehicle: null,
      selectedAccessories: [],
      generatedImageUrl: null,
      generatedImages: [],
      customPrompt: '',
      categoryReferenceImages: {},
      accessoryReferenceImages: {},
    });
    setMake('');
    setModel('');
    setYear('');
  }

  function selectVehicle(vehicle: Vehicle) {
    setConfig({ ...config, vehicleConfigureMode: 'data', vehicle });
  }

  function patchImageModeVehicle(partial: Partial<Pick<Vehicle, 'make' | 'model' | 'year'>>) {
    if (config.vehicle?.id !== USER_UPLOAD_VEHICLE_ID || !config.vehicle.baseImageUrl) return;
    setConfig({
      ...config,
      vehicleConfigureMode: 'images',
      vehicle: { ...config.vehicle, ...partial },
    });
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function handleBaseImageFile(file: File) {
    const vehicleBase = {
      id: USER_UPLOAD_VEHICLE_ID,
      make: make || 'Vehicle',
      model: model || 'Custom',
      year: year || '—',
      variant: 'Your photo',
    } as const;

    const sessionId = (baseUploadSessionRef.current += 1);
    setUploadingBase(true);
    let didUpload = false;
    try {
      // If a previous countdown is running, cancel it so the new upload controls navigation.
      stopRedirect();

      if (isCloudinaryConfigured()) {
        const secureUrl = await uploadImageFile(file);
        if (baseUploadSessionRef.current !== sessionId) return;
        setConfig({
          ...config,
          vehicleConfigureMode: 'images',
          vehicle: { ...vehicleBase, baseImageUrl: secureUrl },
          // New base photo invalidates prior refs and generated output (avoid stale previews after replace).
          categoryReferenceImages: {},
          accessoryReferenceImages: {},
          generatedImageUrl: null,
          generatedImages: [],
        });
        addLog('action', 'Base vehicle image uploaded to Cloudinary', secureUrl);
        didUpload = true;
      } else {
        const dataUrl = await readFileAsDataUrl(file);
        if (baseUploadSessionRef.current !== sessionId) return;
        setConfig({
          ...config,
          vehicleConfigureMode: 'images',
          vehicle: { ...vehicleBase, baseImageUrl: dataUrl },
          categoryReferenceImages: {},
          accessoryReferenceImages: {},
          generatedImageUrl: null,
          generatedImages: [],
        });
        addLog('action', 'Base vehicle image stored locally (data URL)', file.name);
        didUpload = true;
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Failed to upload base vehicle image');
    } finally {
      if (mountedRef.current && baseUploadSessionRef.current === sessionId) {
        setUploadingBase(false);
      }
    }

    // Auto-advance once the base photo upload succeeds.
    if (didUpload) {
      addLog('action', 'Base image upload success (starting countdown)', `file=${file.name}`);
      // Start countdown directly after upload so initial upload works reliably.
      startRedirectCountdown();
    }
  }

  const canUploadBaseImage = !!make && !!model && !!year;

  const dataVehicleReady = mode === 'data' && !!config.vehicle;

  return (
    <div className="max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Step 1 of 2</p>
      <p className="text-3xl font-bold text-white my-2">Select Your Vehicle</p>
      <p className="text-sm text-gray-400 my-6">Choose how you want to define the vehicle for this session</p>

      <div className="flex bg-[#1e1e1e] rounded-lg p-1 border border-[#333] mb-8 max-w-xl">
        <button
          type="button"
          onClick={() => switchMode('data')}
          className={`flex-1 text-xs py-2.5 rounded-md font-semibold transition-all ${
            mode === 'data' ? 'bg-blue-500 text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          Configure by data
        </button>
        <button
          type="button"
          onClick={() => switchMode('images')}
          className={`flex-1 text-xs py-2.5 rounded-md font-semibold transition-all ${
            mode === 'images' ? 'bg-blue-500 text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          Configure with images
        </button>
      </div>

      {mode === 'data' && (
        <>
          <p className="text-sm text-gray-400 mb-8">Choose your make, model and year to see compatible accessories</p>

          <div className="grid grid-cols-3 gap-4 mb-8 max-w-3xl">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Make</label>
              <select
                className="w-full border border-[#3a3a3a] rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-white appearance-none cursor-pointer hover:border-[#4a4a4a] transition-colors"
                value={make}
                onChange={e => {
                  const newMake = e.target.value;
                  setMake(newMake);
                  setModel('');
                  setYear('');
                  if (newMake) addLog('action', `Filter changed: Make = ${newMake}`);
                }}
              >
                <option value="">Select Make</option>
                {makes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Model</label>
              <select
                className="w-full border border-[#3a3a3a] rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-white appearance-none cursor-pointer hover:border-[#4a4a4a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                value={model}
                disabled={!make}
                onChange={e => {
                  const newModel = e.target.value;
                  setModel(newModel);
                  setYear('');
                  if (newModel) addLog('action', `Filter changed: Model = ${newModel}`);
                }}
              >
                <option value="">Select Model</option>
                {(modelsByMake[make] || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Year</label>
              <select
                className="w-full border border-[#3a3a3a] rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-white appearance-none cursor-pointer hover:border-[#4a4a4a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                value={year}
                disabled={!model}
                onChange={e => {
                  const newYear = e.target.value;
                  setYear(newYear);
                  if (newYear) addLog('action', `Filter changed: Year = ${newYear}`, `Make: ${make}, Model: ${model}`);
                }}
              >
                <option value="">Select Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {year && make && model && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Select Variant</p>
              <div className="grid grid-cols-3 gap-4 max-w-3xl mb-8">
                {filteredVehicles.map(v => (
                  <div
                    key={v.id}
                    onClick={() => selectVehicle(v)}
                    className={`bg-[#2a2a2a] rounded-xl p-4 cursor-pointer border transition-all
                      ${config.vehicle?.id === v.id ? 'border-yellow-500 border-2' : 'border-[#3a3a3a] hover:border-[#4a4a4a]'}`}
                  >
                    <div className="text-3xl mb-2">🛻</div>
                    <div className="font-semibold text-sm text-white">{v.model} {v.variant}</div>
                    <div className="text-xs text-gray-400">{v.year} · {v.make}</div>
                    {config.vehicle?.id === v.id && (
                      <div className="text-yellow-500 text-xs font-bold mt-1">✓ Selected</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'images' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-8 items-start">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 my-2">Vehicle details</p>
            <p className="text-xs text-gray-500">Used in prompts and labels. The photo remains the source of truth for appearance.</p>

            <div className="mt-14">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Make</label>
              <select
                className="w-full border border-[#3a3a3a] rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-white appearance-none cursor-pointer hover:border-[#4a4a4a] transition-colors"
                value={make}
                onChange={e => {
                  const newMake = e.target.value;
                  setMake(newMake);
                  setModel('');
                  setYear('');
                  patchImageModeVehicle({ make: newMake || 'Vehicle', model: '', year: '' });
                }}
              >
                <option value="">Select Make</option>
                {makes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="mt-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Model</label>
              <select
                className="w-full border border-[#3a3a3a] rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-white appearance-none cursor-pointer hover:border-[#4a4a4a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                value={model}
                disabled={!make}
                onChange={e => {
                  const newModel = e.target.value;
                  setModel(newModel);
                  setYear('');
                  patchImageModeVehicle({ model: newModel || 'Custom', year: '' });
                }}
              >
                <option value="">Select Model</option>
                {(modelsByMake[make] || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="mt-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Year</label>
              <select
                className="w-full border border-[#3a3a3a] rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-white appearance-none cursor-pointer hover:border-[#4a4a4a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                value={year}
                disabled={!model}
                onChange={e => {
                  const newYear = e.target.value;
                  setYear(newYear);
                  patchImageModeVehicle({ year: newYear || '—' });
                }}
              >
                <option value="">Select Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Base vehicle photo</p>
            <p className="text-sm text-gray-400 mb-4">
              Upload the base vehicle image. Accessories will be composited on top of it.
            </p>
            {isCloudinaryConfigured() ? (
              <p className="text-[12px] text-emerald-400/90 my-3">
                (Uploads go to our cloud and URLs are used for generation. We don't store any images permanently.)
              </p>
            ) : import.meta.env.DEV ? (
              <p className="text-xs text-amber-400/80 mb-3">
                Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to host images on Cloudinary.
              </p>
            ) : null}

            {config.vehicle?.id === USER_UPLOAD_VEHICLE_ID && config.vehicle.baseImageUrl ? (
              <div className="w-full rounded-xl border-2 border-yellow-500/60 bg-[#1a1a1a] overflow-hidden mt-12">
                <div className="relative w-full h-56 bg-black flex items-center justify-center">
                  <img
                    src={config.vehicle.baseImageUrl}
                    alt="Your vehicle"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="px-4 py-3 border-t border-[#333] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">
                      Base image is set. You can change it anytime before generating.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {redirectCountdown !== null && (
                      <div className="text-xs font-bold text-yellow-400 text-right">
                        Redirecting to Configure in {redirectCountdown}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        stopRedirect();
                        changeBaseFileInputRef.current?.click();
                      }}
                      disabled={uploadingBase}
                      title="Change base image"
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#3a3a3a] bg-[#2a2a2a] text-gray-300 hover:text-white hover:border-[#4a4a4a] disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Change base image"
                    >
                      ↻
                    </button>

                    <input
                      ref={changeBaseFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingBase}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleBaseImageFile(file);
                        // Allow selecting the same file again.
                        e.currentTarget.value = '';
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        addLog(
                          'action',
                          'Continue to Accessories clicked (manual)',
                          `Selected: ${config.vehicle?.make} ${config.vehicle?.model} ${config.vehicle?.variant}`
                        );
                        stopRedirect();
                        onNext();
                      }}
                      disabled={uploadingBase}
                      title="Continue to accessories"
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Continue to accessories"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label
                className={`flex flex-col items-center justify-center w-full h-70 rounded-xl border-2 border-dashed border-[#444] bg-[#1a1a1a] transition-colors px-6 mt-12 ${
                  uploadingBase
                    ? 'opacity-60 cursor-wait'
                    : canUploadBaseImage
                      ? 'hover:border-yellow-500/50 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed h-70'
                }`}
              >
                <span className="text-4xl mb-3">{uploadingBase ? '⏳' : '📷'}</span>
                <span className="text-sm font-semibold text-white mb-1">
                  {uploadingBase
                    ? 'Uploading to Cloudinary…'
                    : canUploadBaseImage
                      ? 'Upload vehicle image'
                      : 'Select make, model, and year first'}
                </span>
                <span className="text-xs text-gray-500 text-center">
                  {canUploadBaseImage ? 'PNG or JPG · one file only' : 'Upload is enabled after vehicle details are selected'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingBase || !canUploadBaseImage}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file && canUploadBaseImage) void handleBaseImageFile(file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        </div>
      )}

      {mode === 'data' && (
        <button
          onClick={() => {
            addLog(
              'action',
              'Continue to Accessories clicked',
              `Selected: ${config.vehicle?.make} ${config.vehicle?.model} ${config.vehicle?.variant}`
            );
            onNext();
          }}
          disabled={!dataVehicleReady}
          className="mt-10 bg-[#2a2a2a] border border-[#3a3a3a] text-gray-400 font-bold uppercase tracking-wide px-6 py-3 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3a3a3a] hover:text-white transition-colors"
        >
          Continue to Accessories →
        </button>
      )}
    </div>
  );
}
