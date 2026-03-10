# Changelog

All notable user-facing changes to Sparkly are documented in this file.
Grouped by week, labeled with the Monday date.

## Week of 2026-03-09

- Added dark mode / light mode theme toggle
- Updated favicon to SVG format for better quality
- Added auto-update support for distribution package

## Week of 2026-03-02

- Added category filtering and search to the effects list
- Added blend mode option to Wave effect
- Added color presets to the color picker
- Color parameter now also supports RGB values
- Fixed re-ordering colors via dragging
- Fixed restoring names of cloned effects

## Week of 2026-02-23

- Added state persistence — settings survive restarts
- Added Live preview with FPS display
- Added confirmation dialog for deleting effects
- Added Rename functionality for effects
- Added Reset effect functionality
- Improved handling of disconnected devices
- Improved device discovery reliability
- Added device discovery support when adding devices
- Added Remove Device support
- Added Add Device support
- Improved Wave effect
- Added Loop Cycles parameter
- Added Auto-Rotate mode for cycling effects
- Fixed effect names in device card
- Switched to Multi Color parameters for richer color control
- Added new Wave effect
- Added Color Change effect
- Added Rainbow Rotate mode for Palette
- Added Multiple Palette Order option
- Added Stars effect
- Added more easing options
- Show effect duration during SendMovie
- Added Blocks effect
- Improved Meteor effect
- Added SendMovie dialog with upload progress
- Show current phase and loop duration in UI
- Fixed showing effect type in production mode
- Added check for another app instance already running
- Removed requirement for config file on first run
- Fixed connecting to a new device
- Automated GitHub dev releases

## Week of 2026-02-16

- Show Animation Type in UI
- Split Effect Engine between 3 animation modes (Live, Loop, Static)
- Added easing function for Random Dots
- Improved Random Dots effect
- Added Any Color palette option
- Added Random Dots effect
- Added Effect Deleting feature
- Added Hue Shift parameters
- Added Leds per Pixel parameter
- Added Color Gain parameters
- Added Invert Colors option
- Added 2D Rotation
- Added Gamma parameter per effect
- Added effect cloning feature
- Show effect names instead of IDs
- Added Multi HSL parameter support

## Week of 2026-02-09

- Effects can now self-contain presets
- Added Mirror effect parameter
- Hide Speed parameter for static effects
- Keep Mapping Mode and Speed per each effect
- Split Device and Effect parameters in UI
- Added 1D-2D mapping mode option
- Added option parameter support
- Fetch device modes from backend
- Added TestAllLedsFlash effect
- Fixed remote access

## Week of 2026-02-02

- Added custom gradient support
- Improved Clouds effect
- Use 3 column layout in Device view
- Added multi-color rain effect
- PingPong custom colors
- Improved UX for color parameters
- Added HSL color picker
- Added build date-time display
- Distribution package now embeds frontend assets
- Open browser automatically on start
- Added packaging distribution
- Added gradients and gamma range
- Mirror LEDs option
- Change Sine frequency
- Added support for effect-specific parameters
- Improved parameter UX — dragging and keyboard
- Added color temperature correction
- Added Gamma correction
- Added FPS parameter
- Added Speed parameter
- Added UI for dynamic parameters
- Fixed Meteor effect on fast speed

## Week of 2026-01-26

- Added 2D mapping buffer display
- Added Gravity Fountain effect
- Added 2D effects with Perlin noise support
- Added basic 2D effect support
- Added device details view
- Added refreshing device state
- Added sending movie support
- Restructured project into 3 modules
- Added Twinkle effect
- Added Rain effect
- Added Meteor effect

## Week of 2026-01-19

- Added Rainbow effect
- Show LEDs in frontend

## Week of 2026-01-05

- Added choosing live effects
- Added backend logging with Pino
- Set brightness from UI
- Added mode display in UI
- Added separate Devices page
- Improved connection error handling
- Added effect library listing
- Added info API

## Week of 2025-12-29

- Added SvelteKit frontend
- Added LED configuration and mapping support
- Added RGB+W support
- Added gradient colors
- Added Rotating effect
- Added static frame effect
- Added brightness control
- Added device summary endpoint
- Initial release — basic Twinkly device communication via UDP
