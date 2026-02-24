import type { TypedHandlers } from './TypedHandler';
import { backendApiContract } from '@twinkly-ts/common';
import { deviceService } from './DeviceService';
import { isMovieTaskActive } from './MovieTaskTracker';

/**
 * Controller layer. Receives HTTP requests, validates required params,
 * delegates to DeviceService, and returns TS-Rest-style responses.
 *
 * Does NOT trust input data types — validated by typed handler middleware.
 */
export const apiController: TypedHandlers<typeof backendApiContract> = {
  hello: (_req, res) => {
    res.json({ message: 'Hello from Twinkly Backend!' });
  },

  getSystemInfo: (_req, res) => {
    const info = deviceService.getSystemInfo();
    res.json(info);
  },

  getInfo: async (req, res) => {
    const result = await deviceService.getInfo(req.query.device_id);
    res.json(result);
  },

  debugDevice: async (req, res) => {
    const sections = await deviceService.debugDevice(req.query.device_id);
    res.json({ sections });
  },

  debugEffects: (_req, res) => {
    const result = deviceService.getDebugEffects();
    res.json(result);
  },

  setMode: async (req, res) => {
    await deviceService.setMode(req.body.device_id, req.body.mode);
    res.json({ success: true, mode: req.body.mode });
  },

  setBrightness: async (req, res) => {
    await deviceService.setBrightness(req.body.device_id, req.body.brightness);
    res.json({ success: true });
  },

  chooseEffect: async (req, res) => {
    await deviceService.chooseEffect(req.body.device_id, req.body.effect_id);
    res.json({ success: true });
  },

  getBuffer: async (req, res) => {
    const buffer = deviceService.getBuffer(req.query.device_id);
    res.json(buffer);
  },

  getLedMapping: async (req, res) => {
    const ledMapping = await deviceService.getLedMapping(req.query.device_id);
    res.json(ledMapping);
  },

  sendMovie: async (req, res) => {
    // Fire-and-forget: starts the task in the background and returns immediately
    await deviceService.sendMovie(req.body.device_id, req.body.effect_id);
    res.json({ success: true });
  },

  getMovieStatus: async (req, res) => {
    const task = deviceService.getMovieStatus(req.query.device_id);
    const active = task ? isMovieTaskActive(req.query.device_id) : false;
    res.json({ active, task });
  },

  setParameters: async (req, res) => {
    await deviceService.setParameters(req.body.device_id, req.body.parameters);
    res.json({ success: true });
  },

  cloneEffect: async (req, res) => {
    const result = deviceService.cloneEffect(req.body.effect_id);
    res.json(result);
  },

  deleteEffect: async (req, res) => {
    deviceService.deleteEffect(req.body.effect_id);
    res.json({ success: true });
  },
};
