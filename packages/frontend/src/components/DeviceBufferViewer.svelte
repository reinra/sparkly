<script lang="ts">
  import { tick } from 'svelte';
  import { backendClient } from '../FrontendApiClient';

  interface Props {
    deviceId: string;
    /** When true, live mode is forcibly disabled (e.g. during movie sending). */
    disableLive?: boolean;
  }

  let { deviceId, disableLive = false }: Props = $props();

  type DisplayMode = 'sequence' | '2d-mapping';

  let displayMode = $state<DisplayMode>('sequence');
  let bufferData = $state<string | null>(null);
  let phase = $state<number | null>(null);
  let colors: Array<{ r: number; g: number; b: number }> = [];
  let colorCount = $state(0);
  let ledMapping = $state<Array<{ id: number; x: number; y: number }> | null>(null);
  let fetchingBuffer = $state(false);
  let fetchingMapping = $state(false);
  let isLiveEnabled = $state(false);
  let liveIntervalId: number | null = null;
  let canvas = $state<HTMLCanvasElement | null>(null);
  let sequenceCanvas = $state<HTMLCanvasElement | null>(null);
  let canvasContainerEl = $state<HTMLDivElement | null>(null);
  let liveFps = $state<number | null>(null);
  const FPS_WINDOW_MS = 5000;
  let frameTimestamps: number[] = [];

  function parseBase64ToColors(base64: string): number {
    try {
      // Decode base64 to binary string
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Parse RGB tuples (3 bytes per color) — reuse existing array entries
      const count = Math.floor(bytes.length / 3);
      for (let i = 0; i < count; i++) {
        const bi = i * 3;
        if (i < colors.length) {
          colors[i].r = bytes[bi];
          colors[i].g = bytes[bi + 1];
          colors[i].b = bytes[bi + 2];
        } else {
          colors.push({ r: bytes[bi], g: bytes[bi + 1], b: bytes[bi + 2] });
        }
      }
      // Trim if shorter than before
      colors.length = count;

      return count;
    } catch (error) {
      console.error('Error parsing base64 to colors:', error);
      colors.length = 0;
      return 0;
    }
  }

  async function fetchLedMapping() {
    if (fetchingMapping || ledMapping !== null) return;

    fetchingMapping = true;
    try {
      const result = await backendClient.getLedMapping({
        query: {
          device_id: deviceId,
        },
      });

      if (result.status === 200 && result.body.coordinates) {
        ledMapping = result.body.coordinates;
        console.log('LED mapping loaded:', ledMapping.length, 'LEDs');
      } else {
        console.error('Failed to fetch LED mapping:', result);
        ledMapping = []; // Set to empty array to indicate fetch completed but failed
      }
    } catch (error) {
      console.error('Error fetching LED mapping:', error);
      ledMapping = []; // Set to empty array to indicate fetch completed but failed
    } finally {
      fetchingMapping = false;
    }
  }

  // Sequence mode: box size to match the original CSS (.color-box 24px + 4px gap)
  const SEQ_BOX = 24;
  const SEQ_GAP = 4;
  const SEQ_PAD = 8; // canvas internal padding
  const SEQ_RADIUS = 3;

  let lastSeqCols = 0;
  let lastSeqRows = 0;
  let lastSeqDpr = 0;

  function renderSequenceCanvas() {
    if (!sequenceCanvas || !canvasContainerEl || colors.length === 0) return;

    const dpr = window.devicePixelRatio || 1;

    // Get the container's content width (clientWidth includes padding — subtract it)
    const style = getComputedStyle(canvasContainerEl);
    const contentWidth = canvasContainerEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

    // Compute grid layout based on actual content width
    const availableWidth = contentWidth - SEQ_PAD * 2;
    const cols = Math.max(1, Math.floor((availableWidth + SEQ_GAP) / (SEQ_BOX + SEQ_GAP)));
    const rows = Math.ceil(colors.length / cols);

    // CSS (logical) display size
    const displayW = SEQ_PAD * 2 + cols * SEQ_BOX + (cols - 1) * SEQ_GAP;
    const displayH = SEQ_PAD * 2 + rows * SEQ_BOX + (rows - 1) * SEQ_GAP;

    // Only resize canvas when grid dimensions or DPR change (resizing resets GPU state)
    if (cols !== lastSeqCols || rows !== lastSeqRows || dpr !== lastSeqDpr) {
      // Backing-store size scaled for HiDPI
      sequenceCanvas.width = Math.round(displayW * dpr);
      sequenceCanvas.height = Math.round(displayH * dpr);
      // Explicit CSS size so the browser doesn't scale the canvas
      sequenceCanvas.style.width = displayW + 'px';
      sequenceCanvas.style.height = displayH + 'px';
      lastSeqCols = cols;
      lastSeqRows = rows;
      lastSeqDpr = dpr;
    }

    const ctx = sequenceCanvas.getContext('2d');
    if (!ctx) return;

    // Scale drawing commands so we can keep using logical pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayW, displayH);

    for (let i = 0; i < colors.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = SEQ_PAD + col * (SEQ_BOX + SEQ_GAP);
      const y = SEQ_PAD + row * (SEQ_BOX + SEQ_GAP);
      const c = colors[i];

      ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
      ctx.beginPath();
      ctx.roundRect(x, y, SEQ_BOX, SEQ_BOX, SEQ_RADIUS);
      ctx.fill();

      // Subtle border like the original
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function render2DCanvas() {
    if (!canvas || !ledMapping || colors.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each LED as a circle at its mapped position
    const radius = 8; // Circle radius in pixels
    const padding = 20; // Padding from canvas edges
    const drawWidth = canvas.width - padding * 2;
    const drawHeight = canvas.height - padding * 2;

    for (const coord of ledMapping) {
      if (coord.id < colors.length) {
        const color = colors[coord.id];
        const x = padding + coord.x * drawWidth;
        const y = padding + (1 - coord.y) * drawHeight; // Invert Y axis

        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Add a subtle border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  async function fetchBuffer() {
    if (fetchingBuffer) return;

    fetchingBuffer = true;
    const fetchStartTime = performance.now();
    const frameNow = fetchStartTime;

    try {
      const result = await backendClient.getBuffer({
        query: {
          device_id: deviceId,
        },
      });

      if (result.status === 200) {
        // Update FPS measurement (sliding average over last 5 seconds)
        if (isLiveEnabled) {
          frameTimestamps.push(frameNow);
          const cutoff = frameNow - FPS_WINDOW_MS;
          frameTimestamps = frameTimestamps.filter((t) => t > cutoff);
          if (frameTimestamps.length >= 2) {
            const windowSpan = frameNow - frameTimestamps[0];
            liveFps = ((frameTimestamps.length - 1) / windowSpan) * 1000;
          }
        }

        phase = result.body.phase ?? null;
        bufferData = result.body.base64_encoded;
        if (bufferData) {
          colorCount = parseBase64ToColors(bufferData);

          // Wait for DOM to update — the canvas may have just been mounted
          // (e.g. colorCount went from 0 → N, showing the {#if} block)
          await tick();

          // Render on canvas
          if (displayMode === '2d-mapping') {
            render2DCanvas();
          } else {
            renderSequenceCanvas();
          }
        } else {
          colors.length = 0;
          colorCount = 0;
        }
      } else {
        console.error('Failed to fetch buffer:', result);
        bufferData = null;
        phase = null;
        colors.length = 0;
        colorCount = 0;

        // Stop live polling on error (e.g. device was removed → 404)
        if (isLiveEnabled) {
          isLiveEnabled = false;
          if (liveIntervalId !== null) {
            clearTimeout(liveIntervalId);
            liveIntervalId = null;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching buffer:', error);
      bufferData = null;
      phase = null;
      colors.length = 0;
      colorCount = 0;
    } finally {
      fetchingBuffer = false;

      // Calculate next fetch time for live mode
      const fetchDuration = performance.now() - fetchStartTime;
      const nextInterval = Math.max(50, fetchDuration);

      if (isLiveEnabled && liveIntervalId === null) {
        liveIntervalId = window.setTimeout(() => {
          liveIntervalId = null;
          fetchBuffer();
        }, nextInterval);
      }
    }
  }

  function toggleLiveMode() {
    isLiveEnabled = !isLiveEnabled;

    if (isLiveEnabled) {
      // Start live mode
      frameTimestamps = [];
      liveFps = null;
      fetchBuffer();
    } else {
      // Stop live mode
      if (liveIntervalId !== null) {
        clearTimeout(liveIntervalId);
        liveIntervalId = null;
      }
      liveFps = null;
      frameTimestamps = [];
    }
  }

  async function switchDisplayMode(mode: DisplayMode) {
    displayMode = mode;

    // Fetch LED mapping when switching to 2D mode
    if (mode === '2d-mapping' && ledMapping === null) {
      await fetchLedMapping();
    }

    // The {#if} block destroys/recreates canvas elements on mode switch,
    // so reset cached dimensions to force a proper resize on the new canvas.
    if (mode === 'sequence') {
      lastSeqCols = 0;
      lastSeqRows = 0;
      lastSeqDpr = 0;
    }

    // Wait for DOM to update — the canvas element for the new mode may not be mounted yet
    await tick();

    // Re-render if we have colors
    if (colors.length > 0) {
      if (mode === '2d-mapping') {
        render2DCanvas();
      } else {
        renderSequenceCanvas();
      }
    }
  }

  // Auto-disable live mode when disableLive becomes true, re-enable when it becomes false
  let prevDisableLive = false;
  $effect(() => {
    if (disableLive && isLiveEnabled) {
      isLiveEnabled = false;
      if (liveIntervalId !== null) {
        clearTimeout(liveIntervalId);
        liveIntervalId = null;
      }
    } else if (!disableLive && prevDisableLive) {
      // Re-enable live mode when disableLive is lifted (e.g. dialog closed)
      isLiveEnabled = true;
      fetchBuffer();
    }
    prevDisableLive = disableLive;
  });

  // Re-render canvas when display mode or mapping changes (not on every color update —
  // fetchBuffer already calls the render functions directly)
  $effect(() => {
    // Track displayMode and ledMapping — re-render when they change
    const _mode = displayMode;
    const _mapping = ledMapping;
    if (colors.length > 0) {
      if (_mode === '2d-mapping' && _mapping !== null) {
        render2DCanvas();
      } else if (_mode === 'sequence') {
        renderSequenceCanvas();
      }
    }
  });
</script>

<div class="buffer-section">
  <div class="button-group">
    <button onclick={fetchBuffer} disabled={fetchingBuffer || isLiveEnabled} class="fetch-buffer-btn">
      Fetch Device Buffer
    </button>
    <button onclick={toggleLiveMode} class="live-toggle-btn" class:active={isLiveEnabled} disabled={disableLive}>
      {isLiveEnabled ? 'Disable Live' : 'Enable Live'}
    </button>
    {#if isLiveEnabled && liveFps !== null}
      <span class="fps-indicator">{liveFps.toFixed(1)} FPS</span>
    {/if}
  </div>

  <div class="mode-toggle">
    <button onclick={() => switchDisplayMode('sequence')} class="mode-btn" class:active={displayMode === 'sequence'}>
      Sequence
    </button>
    <button
      onclick={() => switchDisplayMode('2d-mapping')}
      class="mode-btn"
      class:active={displayMode === '2d-mapping'}
      disabled={fetchingMapping}
    >
      {fetchingMapping ? 'Loading...' : '2D Mapping'}
    </button>
  </div>

  {#if phase != null}
    <div class="phase-bar">
      <strong>Phase:</strong>
      <div class="phase-track">
        <div class="phase-fill" style="width: {(phase * 100).toFixed(1)}%"></div>
      </div>
      <span class="phase-label">{(phase * 100).toFixed(1)}%</span>
    </div>
  {/if}

  {#if colorCount > 0}
    <div class="buffer-data">
      <strong>Buffer Colors ({colorCount} LEDs):</strong>

      {#if displayMode === 'sequence'}
        <div class="canvas-container" bind:this={canvasContainerEl}>
          <canvas bind:this={sequenceCanvas} class="sequence-canvas"></canvas>
        </div>
      {:else if displayMode === '2d-mapping'}
        <div class="canvas-container">
          {#if fetchingMapping}
            <p>Loading LED mapping...</p>
          {:else if ledMapping === null}
            <p>LED mapping not loaded yet</p>
          {:else if ledMapping.length === 0}
            <p>Failed to load LED mapping. Check console for errors.</p>
          {:else}
            <canvas bind:this={canvas} width="600" height="600"></canvas>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .buffer-section {
    margin-top: 1rem;
    border-top: 1px solid #eee;
  }

  .button-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .fetch-buffer-btn {
    background-color: #ff3e00;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color 0.2s;
  }

  .fetch-buffer-btn:hover:not(:disabled) {
    background-color: #cc3200;
  }

  .fetch-buffer-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  .live-toggle-btn {
    background-color: #4caf50;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color 0.2s;
    min-width: 120px;
  }

  .live-toggle-btn:hover {
    background-color: #45a049;
  }

  .live-toggle-btn.active {
    background-color: #f44336;
  }

  .live-toggle-btn.active:hover {
    background-color: #da190b;
  }

  .fps-indicator {
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    color: #666;
    align-self: center;
    padding: 0 0.25rem;
  }

  .buffer-data {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: #f5f5f5;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .sequence-canvas {
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 3px;
    /* width & height set explicitly via JS to match the canvas backing store */
  }

  .mode-toggle {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .mode-btn {
    background-color: #2196f3;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.4rem 0.8rem;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background-color 0.2s;
    min-width: 100px;
  }

  .mode-btn:hover:not(:disabled) {
    background-color: #1976d2;
  }

  .mode-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  .mode-btn.active {
    background-color: #0d47a1;
    font-weight: bold;
  }

  .canvas-container {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 3px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  canvas {
    border: 1px solid #ddd;
    background-color: #000;
  }

  .phase-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    font-size: 0.85rem;
  }

  .phase-track {
    flex: 1;
    height: 12px;
    background-color: #e0e0e0;
    border-radius: 6px;
    overflow: hidden;
  }

  .phase-fill {
    height: 100%;
    background-color: #4caf50;
    border-radius: 6px;
    transition: width 0.1s linear;
  }

  .phase-label {
    min-width: 4rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
