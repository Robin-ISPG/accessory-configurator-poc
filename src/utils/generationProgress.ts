/**
 * Simulated progress for image generation: ramps to ~82%, then slow creep to 96%
 * while the real API runs (avoids a frozen bar during long NanoBanana polls).
 */
export function startGenerationProgress(
  setProgress: (n: number | ((prev: number) => number)) => void,
  setLoadingMsg: (s: string) => void
): () => void {
  const steps = [
    { at: 0, msg: 'Preparing your vehicle...' },
    { at: 24, msg: 'Adding accessories...' },
    { at: 48, msg: 'Applying lighting...' },
    { at: 66, msg: 'Sending request to image service...' },
  ] as const;

  setProgress(6);
  setLoadingMsg(steps[0].msg);

  let p = 6;
  let stepIdx = 0;
  let slowId: number | null = null;

  const fastId = window.setInterval(() => {
    if (slowId !== null) return;

    p += 1.45;
    if (p >= 82) {
      window.clearInterval(fastId);
      setProgress(82);
      setLoadingMsg(
        'Generating image — cloud step often takes 30–120s. You can keep this tab open; progress below still updates.'
      );
      slowId = window.setInterval(() => {
        setProgress((prev) => (prev >= 96 ? 96 : Math.min(96, prev + 0.45)));
      }, 380);
      return;
    }

    const next = Math.min(81, Math.round(p));
    setProgress(next);
    while (stepIdx < steps.length - 1 && p >= steps[stepIdx + 1].at) {
      stepIdx += 1;
      setLoadingMsg(steps[stepIdx].msg);
    }
  }, 105);

  return () => {
    window.clearInterval(fastId);
    if (slowId !== null) window.clearInterval(slowId);
  };
}
