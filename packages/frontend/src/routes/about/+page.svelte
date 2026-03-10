<script lang="ts">
  import { deviceStore } from '../../stores/DeviceStore.svelte';

  // Simple markdown-to-HTML for changelog: headings, lists, bold, links
  function renderChangelog(md: string): string {
    return md
      .split('\n')
      .map((line) => {
        if (line.startsWith('## ')) return `<h3>${line.slice(3)}</h3>`;
        if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
        return '';
      })
      .join('\n');
  }
</script>

<div class="about-page">
  <h2>About Sparkly</h2>

  <div class="about-card">
    <div class="about-section">
      <p class="tagline">LED controller for Twinkly devices</p>
      <p class="copyright">&copy; 2025 Rein Raudj&auml;rv &mdash; MIT License</p>
      <p>
        <a href="https://github.com/reinra/sparkly" target="_blank" rel="noopener noreferrer" class="homepage-link">
          GitHub &mdash; github.com/reinra/sparkly
        </a>
      </p>
    </div>
  </div>

  {#if deviceStore.changelog}
    <div class="changelog-card">
      <h3>Changelog</h3>
      <div class="changelog-content">
        {@html renderChangelog(deviceStore.changelog)}
      </div>
    </div>
  {/if}
</div>

<style>
  .about-page {
    max-width: 800px;
    margin: 0 auto;
  }

  .about-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 1.5rem;
  }

  .about-section {
    text-align: center;
  }

  .tagline {
    font-size: 1.1rem;
    color: var(--color-text-secondary);
    margin-bottom: 0.5rem;
  }

  .copyright {
    color: var(--color-text-muted);
    margin-bottom: 1rem;
  }

  .homepage-link {
    color: var(--color-accent);
    text-decoration: none;
    font-weight: 500;
  }

  .homepage-link:hover {
    text-decoration: underline;
  }

  .changelog-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 2rem;
  }

  .changelog-card h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--color-text-heading);
  }

  .changelog-content :global(h3) {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-strong);
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .changelog-content :global(h3:first-child) {
    margin-top: 0;
  }

  .changelog-content :global(li) {
    color: var(--color-text-primary);
    margin-bottom: 0.25rem;
    margin-left: 1.5rem;
    list-style-type: disc;
  }

  .changelog-content :global(p) {
    color: var(--color-text-secondary);
    margin: 0.25rem 0;
  }
</style>
