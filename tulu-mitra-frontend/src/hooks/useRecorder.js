import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Microphone capture + live amplitude.
 *
 * The amplitude is read from a Web Audio AnalyserNode and exposed through a
 * ref (getLevel) rather than React state, so the voice visualiser can animate
 * at 60fps without re-rendering the conversation on every frame.
 */
export default function useRecorder() {
  const [status, setStatus] = useState("idle"); // idle | requesting | recording
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataRef = useRef(null);
  const levelRef = useRef(0);
  const rafRef = useRef(0);

  const teardown = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current?.state !== "closed") audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    levelRef.current = 0;
  }, []);

  useEffect(() => teardown, [teardown]);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    analyser.getByteTimeDomainData(dataRef.current);
    let peak = 0;
    for (let i = 0; i < dataRef.current.length; i += 4) {
      const v = Math.abs(dataRef.current[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    // Ease toward the new peak so the rings breathe instead of flickering.
    levelRef.current += (Math.min(1, peak * 2.6) - levelRef.current) * 0.22;
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.fftSize);
      rafRef.current = requestAnimationFrame(tick);

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.start();
      recorderRef.current = recorder;
      setStatus("recording");
      return true;
    } catch (err) {
      teardown();
      setStatus("idle");
      setError(
        err?.name === "NotAllowedError" || err?.name === "SecurityError"
          ? "Microphone access is required for voice interaction."
          : "No microphone was found. Connect one and try again."
      );
      return false;
    }
  }, [teardown, tick]);

  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === "inactive") {
          teardown();
          setStatus("idle");
          resolve(null);
          return;
        }
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          teardown();
          setStatus("idle");
          resolve(blob.size ? blob : null);
        };
        recorder.stop();
      }),
    [teardown]
  );

  const readLevel = useCallback(() => levelRef.current, []);

  const cancel = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    teardown();
    setStatus("idle");
  }, [teardown]);

  return {
    status,
    error,
    clearError: () => setError(null),
    start,
    stop,
    cancel,
    getLevel: readLevel,
    isRecording: status === "recording",
  };
}
