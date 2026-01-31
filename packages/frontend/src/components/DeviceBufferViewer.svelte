<script lang="ts">
  import { backendClient } from '../frontendApiClient';

  interface Props {
    deviceId: string;
  }

  let { deviceId }: Props = $props();

  let bufferData = $state<string | null>(null);
  let colors = $state<Array<{ r: number; g: number; b: number }>>([]);
  let fetchingBuffer = $state(false);
  let isLiveEnabled = $state(false);
  let isRendering = $state(false);
  let liveIntervalId: number | null = null;

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
          // Allow browser to render before marking as complete
          await new Promise(resolve => setTimeout(resolve, 0));
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
</script>

<div class="buffer-section">
  <div class="button-group">
    <button onclick={fetchBuffer} disabled={fetchingBuffer || isLiveEnabled} class="fetch-buffer-btn">
      {fetchingBuffer && !isLiveEnabled ? 'Fetching...' : 'Fetch Device Buffer'}
    </button>
    <button onclick={toggleLiveMode} class="live-toggle-btn" class:active={isLiveEnabled}>
      {isLiveEnabled ? 'Disable Live' : 'Enable Live'}
    </button>
  </div>
  {#if colors.length > 0}
    <div class="buffer-data">
      <strong>Buffer Colors ({colors.length} LEDs):</strong>
      <div class="color-grid">
        {#each colors as color}
          <div
            class="color-box"
            style="background-color: rgb({color.r}, {color.g}, {color.b});"
            title="RGB({color.r}, {color.g}, {color.b})"
          ></div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .buffer-section {
    margin-top: 1rem;
    padding-top: 1rem;
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
    min-width: 180px;
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
</style>
