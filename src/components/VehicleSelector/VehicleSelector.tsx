import { useState, useEffect } from 'react';
import type { Configuration, Vehicle, VehicleConfigureMode } from '../../types';
import { makes, modelsByMake, years, vehicles } from '../../data/vehicles';
import { isCloudinaryConfigured, uploadImageFile } from '../../services/cloudinary';

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
  const [uploadingBase, setUploadingBase] = useState(false);

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

  async function handleBaseImageFile(file: File) {
    const vehicleBase = {
      id: USER_UPLOAD_VEHICLE_ID,
      make: make || 'Vehicle',
      model: model || 'Custom',
      year: year || '—',
      variant: 'Your photo',
    } as const;

    if (isCloudinaryConfigured()) {
      setUploadingBase(true);
      try {
        const secureUrl = await uploadImageFile(file);
        setConfig({
          ...config,
          vehicleConfigureMode: 'images',
          vehicle: { ...vehicleBase, baseImageUrl: secureUrl },
        });
        addLog('action', 'Base vehicle image uploaded to Cloudinary', secureUrl);
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : 'Cloudinary upload failed');
      } finally {
        setUploadingBase(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setConfig({
        ...config,
        vehicleConfigureMode: 'images',
        vehicle: { ...vehicleBase, baseImageUrl: dataUrl },
      });
      addLog('action', 'Base vehicle image stored locally (data URL)', file.name);
    };
    reader.readAsDataURL(file);
  }

  const imageVehicleReady =
    mode === 'images' &&
    config.vehicle?.id === USER_UPLOAD_VEHICLE_ID &&
    !!config.vehicle.baseImageUrl &&
    !!make &&
    !!model &&
    !!year;

  const dataVehicleReady = mode === 'data' && !!config.vehicle;

  return (
    <div className="max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Step 1 of 2</p>
      <h1 className="text-3xl font-bold text-white mb-1">Select Your Vehicle</h1>
      <p className="text-sm text-gray-400 mb-6">Choose how you want to define the vehicle for this session</p>

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
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] gap-8 items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Base vehicle photo</p>
            <p className="text-sm text-gray-400 mb-4">
              Upload the vehicle image used as the fixed base. It will not be replaced during generation; accessories are composited on top with aspect ratios preserved.
            </p>
            {isCloudinaryConfigured() ? (
              <p className="text-xs text-emerald-400/90 mb-3">
                Cloudinary is configured — uploads go to your cloud and URLs are used for generation.
              </p>
            ) : (
              <p className="text-xs text-amber-400/80 mb-3">
                Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in <code className="text-amber-200">.env.local</code> to host images on Cloudinary (smaller API payloads).
              </p>
            )}

            {config.vehicle?.id === USER_UPLOAD_VEHICLE_ID && config.vehicle.baseImageUrl ? (
              <div className="rounded-xl border-2 border-yellow-500/60 bg-[#1a1a1a] overflow-hidden">
                <div className="relative aspect-4/3 bg-black flex items-center justify-center">
                  <img
                    src={config.vehicle.baseImageUrl}
                    alt="Your vehicle"
                    className="max-w-full max-h-full w-auto h-auto object-contain"
                  />
                </div>
                <div className="px-4 py-3 border-t border-[#333] flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-400">
                    Base image is locked for this configuration. Switch tabs above to start over with a different method.
                  </p>
                </div>
              </div>
            ) : (
              <label
                className={`flex flex-col items-center justify-center min-h-[280px] rounded-xl border-2 border-dashed border-[#444] bg-[#1a1a1a] transition-colors px-6 ${
                  uploadingBase ? 'opacity-60 cursor-wait' : 'hover:border-yellow-500/50 cursor-pointer'
                }`}
              >
                <span className="text-4xl mb-3">{uploadingBase ? '⏳' : '📷'}</span>
                <span className="text-sm font-semibold text-white mb-1">
                  {uploadingBase ? 'Uploading to Cloudinary…' : 'Upload vehicle image'}
                </span>
                <span className="text-xs text-gray-500 text-center">PNG or JPG · one file only</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingBase}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void handleBaseImageFile(file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Vehicle details</p>
            <p className="text-xs text-gray-500">Used in prompts and labels. The photo remains the source of truth for appearance.</p>

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
                  patchImageModeVehicle({ make: newMake || 'Vehicle', model: '', year: '' });
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
                  patchImageModeVehicle({ model: newModel || 'Custom', year: '' });
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
                  patchImageModeVehicle({ year: newYear || '—' });
                }}
              >
                <option value="">Select Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          addLog('action', 'Continue to Accessories clicked', `Selected: ${config.vehicle?.make} ${config.vehicle?.model} ${config.vehicle?.variant}`);
          onNext();
        }}
        disabled={!(imageVehicleReady || dataVehicleReady)}
        className="mt-10 bg-[#2a2a2a] border border-[#3a3a3a] text-gray-400 font-bold uppercase tracking-wide px-6 py-3 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3a3a3a] hover:text-white transition-colors"
      >
        Continue to Accessories →
      </button>
    </div>
  );
}
