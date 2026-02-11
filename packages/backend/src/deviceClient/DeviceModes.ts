
export interface DeviceMode {
    key: string; // internal key used for API calls
    title: string; // For display purposes
    description: string; // For display purposes
}

export const DEVICE_MODES: DeviceMode[] = [
    {
        key: 'off',
        title: 'Off',
        description: 'Lights are turned off',
    },
    {
        key: 'color',
        title: 'Color',
        description: 'Lights show a static color',
    },
    {
        key: 'demo',
        title: 'Demo',
        description: 'Demo mode, cycles through pre-defined effects',
    },
    {
        key: 'effect',
        title: 'Effect',
        description: 'Plays a predefined effect',
    },
    {
        key: 'movie',
        title: 'Movie',
        description: 'Plays an uploaded movie',
    },
    {
        key: 'playlist',
        title: 'Playlist',
        description: 'Plays a playlist of movies and effects',
    },
    {
        key: 'rt',
        title: 'Real-time',
        description: 'Receive effect in real time',
    },
];

export const DEVICE_MODE_KEYS: readonly string[] = DEVICE_MODES.map(mode => mode.key);
