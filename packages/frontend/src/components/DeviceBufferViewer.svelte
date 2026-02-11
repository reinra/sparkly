<script lang="ts">
  import { backendClient } from '../frontendApiClient';

  interface Props {
    deviceId: string;
  }

  let { deviceId }: Props = $props();

  type DisplayMode = 'sequence' | '2d-mapping';

  let displayMode = $state<DisplayMode>('sequence');
  let bufferData = $state<string | null>(null);
  let colors = $state<Array<{ r: number; g: number; b: number }>>([]);
  let ledMapping = $state<Array<{ id: number; x: number; y: number }> | null>(null);
  let fetchingBuffer = $state(false);
  let fetchingMapping = $state(false);
  let isLiveEnabled = $state(false);
  let isRendering = $state(false);
  let liveIntervalId: number | null = null;
  let canvas = $state<HTMLCanvasElement | null>(null);

  function parseBase64ToColors(base64: string): Array<{ r: number; g: number; b: number }> {
    try {
      // Decode base64 to binary string
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Parse RGB tuples (3 bytes per color)
      const colorArray: Array<{ r: number; g: number; b: number }> = [];
      for (let i = 0; i < bytes.length; i += 3) {
        if (i + 2 < bytes.length) {
          colorArray.push({
            r: bytes[i],
            g: bytes[i + 1],
            b: bytes[i + 2],
          });
        }
      }

      return colorArray;
    } catch (error) {
      console.error('Error parsing base64 to colors:', error);
      return [];
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
    if (fetchingBuffer || isRendering) return;

    fetchingBuffer = true;
    const fetchStartTime = performance.now();

    try {
      const result = await backendClient.getBuffer({
        query: {
          device_id: deviceId,
        },
      });

      if (result.status === 200) {
        bufferData = result.body.base64_encoded;
        if (bufferData) {
          isRendering = true;
          colors = parseBase64ToColors(bufferData);

          // Render on canvas if in 2D mode
          if (displayMode === '2d-mapping') {
            await new Promise((resolve) => setTimeout(resolve, 0));
            render2DCanvas();
          }

          // Allow browser to render before marking as complete
          await new Promise((resolve) => setTimeout(resolve, 0));
          isRendering = false;
        } else {
          colors = [];
        }
      } else {
        console.error('Failed to fetch buffer:', result);
        bufferData = null;
        colors = [];
      }
    } catch (error) {
      console.error('Error fetching buffer:', error);
      bufferData = null;
      colors = [];
    } finally {
      fetchingBuffer = false;

      // Calculate next fetch time for live mode
      const fetchDuration = performance.now() - fetchStartTime;
      const nextInterval = Math.max(100, fetchDuration);

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
      fetchBuffer();
    } else {
      // Stop live mode
      if (liveIntervalId !== null) {
        clearTimeout(liveIntervalId);
        liveIntervalId = null;
      }
    }
  }

  async function switchDisplayMode(mode: DisplayMode) {
    displayMode = mode;

    // Fetch LED mapping when switching to 2D mode
    if (mode === '2d-mapping' && ledMapping === null) {
      await fetchLedMapping();
    }

    // Re-render if we have colors
    if (colors.length > 0 && mode === '2d-mapping') {
      await new Promise((resolve) => setTimeout(resolve, 0));
      render2DCanvas();
    }
  }

  // Re-render canvas when colors update in 2D mode
  $effect(() => {
    if (displayMode === '2d-mapping' && colors.length > 0 && ledMapping !== null) {
      render2DCanvas();
    }
  });
</script>

<div class="buffer-section">
  <div class="button-group">
    <button onclick={fetchBuffer} disabled={fetchingBuffer || isLiveEnabled} class="fetch-buffer-btn">
      Fetch Device Buffer
    </button>
    <button onclick={toggleLiveMode} class="live-toggle-btn" class:active={isLiveEnabled}>
      {isLiveEnabled ? 'Disable Live' : 'Enable Live'}
    </button>
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

  {#if colors.length > 0}
    <div class="buffer-data">
      <strong>Buffer Colors ({colors.length} LEDs):</strong>

      {#if displayMode === 'sequence'}
        <div class="color-grid">
          {#each colors as color}
            <div
              class="color-box"
              style="background-color: rgb({color.r}, {color.g}, {color.b});"
              title="RGB({color.r}, {color.g}, {color.b})"
            ></div>
          {/each}
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

  .buffer-data {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: #f5f5f5;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .color-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 3px;
  }

  .color-box {
    width: 24px;
    height: 24px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: transform 0.1s;
  }

  .color-box:hover {
    transform: scale(1.3);
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
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
</style>
