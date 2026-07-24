import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { ArrowRight, Camera, Car, Check, Loader2, RefreshCw } from 'lucide-react';
import type { Configuration, Vehicle, VehicleConfigureMode } from '../../types';
import { makes, modelsByMake, years, vehicles } from '../../data/vehicles';
import {
  blobUrlToDataUrl,
  isCloudinaryConfigured,
  isDataUrl,
  uploadImageDataUrl,
  uploadImageFile,
} from '../../services/cloudinary';
import { generateImage, paramsForCatalogVehicleBaseImage } from '../../services/imageService';
import { startGenerationProgress } from '../../utils/generationProgress';
import LoadingOverlay from '../ui/LoadingOverlay';

import type { LogEntry } from '../LogBox/LogBox';

const USER_UPLOAD_VEHICLE_ID = 'user-uploaded-vehicle';

interface Props {
  config: Configuration;
  setConfig: (c: Configuration) => void;
  onNext: () => void;
  addLog: (type: LogEntry['type'], message: string, details?: string) => void;
}

export default function VehicleSelector({ config, setConfig, onNext, addLog }: Props) {
  const mode = config.vehicleConfigureMode;
  const [make, setMake] = useState(config.vehicle?.make || '');
  const [model, setModel] = useState(config.vehicle?.model || '');
  const [year, setYear] = useState(config.vehicle?.year || '');
  /** Catalog vehicle id — selected trim for image mode (dropdown value) */
  const [variantVehicleId, setVariantVehicleId] = useState('');
  const [uploadingBase, setUploadingBase] = useState(false);
  const [autoGenerateVehicleImage, setAutoGenerateVehicleImage] = useState(false);
  const [isPreparingBaseImage, setIsPreparingBaseImage] = useState(false);
  const [prepProgress, setPrepProgress] = useState(0);
  const [prepLoadingMsg, setPrepLoadingMsg] = useState('Preparing your vehicle...');
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
    if (config.vehicle?.baseImageUrl?.trim()) {
      setAutoGenerateVehicleImage(false);
    }
  }, [config.vehicle?.id, config.vehicle?.baseImageUrl]);

  useEffect(() => {
    if (!config.vehicle) return;
    if (config.vehicle.id === USER_UPLOAD_VEHICLE_ID) {
      setMake(config.vehicle.make);
      setModel(config.vehicle.model);
      setYear(config.vehicle.year);
      const candidates = vehicles.filter(
        (v) =>
          v.make === config.vehicle!.make &&
          v.model === config.vehicle!.model &&
          v.year === config.vehicle!.year
      );
      const match = candidates.find((v) => v.variant === config.vehicle!.variant);
      setVariantVehicleId(match?.id ?? '');
      return;
    }
    if (mode === 'data') {
      setMake(config.vehicle.make);
      setModel(config.vehicle.model);
      setYear(config.vehicle.year);
    }
  }, [config.vehicle?.id, config.vehicle?.variant, config.vehicle?.make, config.vehicle?.model, config.vehicle?.year, mode]);

  const filteredVehicles = vehicles.filter(v =>
    (!make || v.make === make) &&
    (!model || v.model === model) &&
    (!year || v.year === year)
  );

  function switchMode(next: VehicleConfigureMode) {
    if (next === mode) return;

    // If switching from image-mode back to data-mode, clear everything Cloudinary uploaded
    // into the `Vehicles/` folder. Fire-and-forget (do not block the UI).
    // Disabled for now (browser Admin API DELETE hits CORS; use a serverless proxy when re-enabling).
    // if (next === 'data' && mode === 'images') {
    //   showToast('Cleaning Cloudinary Vehicles images…');
    //   addLog('action', 'Starting Cloudinary cleanup for Vehicles/ folder');
    //   void cleanupVehiclesFolderImages().catch((e: unknown) => {
    //     console.error(e);
    //     addLog(
    //       'error',
    //       'Cloudinary cleanup failed',
    //       e instanceof Error ? e.message : 'Unknown error'
    //     );
    //   });
    // }

    addLog('action', `Vehicle step: switched to ${next === 'data' ? 'configure by data' : 'configure with images'}`);
    setConfig({
      ...config,
      vehicleConfigureMode: next,
      vehicle: null,
      selectedAccessories: [],
      generatedImageUrl: null,
      generatedImages: [],
      lastReframeViewName: null,
      lastReframeViewPrompt: null,
      customPrompt: '',
      categoryReferenceImages: {},
      accessoryReferenceImages: {},
      exteriorBodyColor: null,
    });
    setMake('');
    setModel('');
    setYear('');
    setVariantVehicleId('');
  }

  function selectVehicle(vehicle: Vehicle) {
    const prev = config.vehicle;
    const sameId = prev?.id === vehicle.id;
    const baseImageUrl = sameId
      ? (prev?.baseImageUrl?.trim() || vehicle.baseImageUrl || '')
      : (vehicle.baseImageUrl || '');
    setConfig({
      ...config,
      vehicleConfigureMode: 'data',
      vehicle: { ...vehicle, baseImageUrl },
    });
  }

  function patchImageModeVehicle(
    partial: Partial<Pick<Vehicle, 'make' | 'model' | 'year' | 'variant'>>
  ) {
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
    const catalogPick = variantVehicleId
      ? vehicles.find((v) => v.id === variantVehicleId)
      : undefined;
    const vehicleBase = {
      id: USER_UPLOAD_VEHICLE_ID,
      make: make || 'Vehicle',
      model: model || 'Custom',
      year: year || '—',
      variant: catalogPick?.variant ?? 'Your photo',
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
          exteriorBodyColor: null,
          generatedImageUrl: null,
          generatedImages: [],
          lastReframeViewName: null,
          lastReframeViewPrompt: null,
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
          exteriorBodyColor: null,
          generatedImageUrl: null,
          generatedImages: [],
          lastReframeViewName: null,
          lastReframeViewPrompt: null,
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

  const canUploadBaseImage = !!make && !!model && !!year && !!variantVehicleId;

  const dataVehicleReady = mode === 'data' && !!config.vehicle;

  async function handleContinueToAccessories() {
    if (!config.vehicle || mode !== 'data') return;
    addLog(
      'action',
      'Continue to Accessories clicked',
      `Selected: ${config.vehicle.make} ${config.vehicle.model} ${config.vehicle.variant}`
    );

    const v = config.vehicle;
    const hasCatalogBase = Boolean(v.baseImageUrl?.trim());

    if (autoGenerateVehicleImage && !hasCatalogBase) {
      setIsPreparingBaseImage(true);
      const stopProgress = startGenerationProgress(setPrepProgress, setPrepLoadingMsg);
      try {
        const result = await generateImage(paramsForCatalogVehicleBaseImage(v));
        let finalUrl = result.imageUrl.trim();

        if (isCloudinaryConfigured()) {
          if (isDataUrl(finalUrl)) {
            finalUrl = await uploadImageDataUrl(finalUrl);
          } else if (finalUrl.startsWith('blob:')) {
            try {
              const dataUrl = await blobUrlToDataUrl(finalUrl);
              finalUrl = await uploadImageDataUrl(dataUrl);
            } finally {
              URL.revokeObjectURL(result.imageUrl);
            }
          }
        } else if (finalUrl.startsWith('blob:')) {
          try {
            finalUrl = await blobUrlToDataUrl(finalUrl);
          } finally {
            URL.revokeObjectURL(result.imageUrl);
          }
        }

        addLog('api', 'Catalog base vehicle image generated', finalUrl.slice(0, 120));
        flushSync(() => {
          setConfig({
            ...config,
            vehicle: { ...v, baseImageUrl: finalUrl },
          });
        });
      } catch (e) {
        console.error(e);
        addLog(
          'error',
          'Failed to auto-generate base vehicle image',
          e instanceof Error ? e.message : 'Unknown error'
        );
        alert(
          e instanceof Error
            ? e.message
            : 'Could not generate the base vehicle image. Try again or continue without a base photo.'
        );
        stopProgress();
        setPrepProgress(0);
        setIsPreparingBaseImage(false);
        return;
      }
      stopProgress();
      setPrepProgress(0);
      setIsPreparingBaseImage(false);
    }

    onNext();
  }

  return (
    <div className="max-w-4xl">
      {isPreparingBaseImage && (
        <LoadingOverlay loadingMsg={prepLoadingMsg} progress={prepProgress} />
      )}
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
                {filteredVehicles.map(v => {
                  const sessionThumb =
                    config.vehicle?.id === v.id && config.vehicle.baseImageUrl?.trim()
                      ? config.vehicle.baseImageUrl
                      : '';
                  const thumbSrc = sessionThumb || v.baseImageUrl?.trim() || '';
                  return (
                  <div
                    key={v.id}
                    onClick={() => selectVehicle(v)}
                    className={`bg-[#2a2a2a] rounded-xl p-4 cursor-pointer border transition-all
                      ${config.vehicle?.id === v.id ? 'border-yellow-500 border-2' : 'border-[#3a3a3a] hover:border-[#4a4a4a]'}`}
                  >
                    <div className="mb-2 h-24 w-full rounded-lg overflow-hidden bg-black/40 flex items-center justify-center">
                      {thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt=""
                          className="h-full w-full object-cover object-center"
                          loading="lazy"
                        />
                      ) : (
                        <Car className="h-10 w-10 text-gray-500/80" strokeWidth={1.5} aria-hidden />
                      )}
                    </div>
                    <div className="font-semibold text-sm text-white">{v.model} {v.variant}</div>
                    <div className="text-xs text-gray-400">{v.year} · {v.make}</div>
                    {config.vehicle?.id === v.id && (
                      <div className="text-yellow-500 text-xs font-bold mt-1 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
                        Selected
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {config.vehicle && !config.vehicle.baseImageUrl?.trim() ? (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[#3a3a3a] bg-[#1e1e1e] p-4 max-w-3xl">
                  <input
                    type="checkbox"
                    checked={autoGenerateVehicleImage}
                    onChange={(e) => setAutoGenerateVehicleImage(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-[#555] bg-[#2a2a2a] text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm text-gray-300 leading-snug">
                    <span className="font-semibold text-white">Auto-generate vehicle image</span>
                    <span className="block text-xs text-gray-500 mt-1">
                      Uses your configured image API, then uploads to Cloudinary.
                    </span>
                  </span>
                </label>
              ) : null}
            </div>
          )}
        </>
      )}

      {mode === 'images' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-8 items-start">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 my-2">Vehicle details</p>
            <p className="text-xs text-gray-500">Used in prompts and labels. The photo remains the source of truth for appearance.</p>

            <div className="mt-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Make</label>
              <select
                className="w-full border border-[#3a3a3a] rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-white appearance-none cursor-pointer hover:border-[#4a4a4a] transition-colors"
                value={make}
                onChange={e => {
                  const newMake = e.target.value;
                  setMake(newMake);
                  setModel('');
                  setYear('');
                  setVariantVehicleId('');
                  patchImageModeVehicle({
                    make: newMake || 'Vehicle',
                    model: '',
                    year: '',
                    variant: '',
                  });
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
                  setVariantVehicleId('');
                  patchImageModeVehicle({ model: newModel || 'Custom', year: '', variant: '' });
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
                  setVariantVehicleId('');
                  patchImageModeVehicle({ year: newYear || '—', variant: '' });
                }}
              >
                <option value="">Select Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="mt-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Variant</label>
              <select
                className="w-full border border-[#3a3a3a] rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-white appearance-none cursor-pointer hover:border-[#4a4a4a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                value={variantVehicleId}
                disabled={!year}
                onChange={(e) => {
                  const id = e.target.value;
                  setVariantVehicleId(id);
                  const picked = vehicles.find((v) => v.id === id);
                  patchImageModeVehicle({ variant: picked?.variant ?? '' });
                }}
              >
                <option value="">Select Variant</option>
                {filteredVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.variant}
                  </option>
                ))}
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
                      <RefreshCw className="h-4 w-4" aria-hidden />
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
                      disabled={uploadingBase && redirectCountdown === null}
                      title="Continue to accessories"
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Continue to accessories"
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden />
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
                <span className="mb-3 text-gray-400">
                  {uploadingBase ? (
                    <Loader2 className="h-10 w-10 animate-spin" strokeWidth={2} aria-hidden />
                  ) : (
                    <Camera className="h-10 w-10" strokeWidth={1.5} aria-hidden />
                  )}
                </span>
                <span className="text-sm font-semibold text-white mb-1">
                  {uploadingBase
                    ? 'Uploading to Cloudinary…'
                    : canUploadBaseImage
                      ? 'Upload vehicle image'
                      : 'Select make, model, year, and variant first'}
                </span>
                <span className="text-xs text-gray-500 text-center">
                  {canUploadBaseImage
                    ? 'PNG or JPG · one file only'
                    : 'Upload is enabled after vehicle details are selected'}
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
          type="button"
          onClick={() => void handleContinueToAccessories()}
          disabled={!dataVehicleReady || isPreparingBaseImage}
          className="mt-10 bg-[#2a2a2a] border border-[#3a3a3a] text-gray-400 font-bold uppercase tracking-wide px-6 py-3 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3a3a3a] hover:text-white transition-colors"
        >
          Continue to Accessories →
        </button>
      )}
    </div>
  );
}
