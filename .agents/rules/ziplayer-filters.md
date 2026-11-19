---
trigger: glob
globs: "src/**/*.ts"
description: Chu ky ham thuc te cua ban ziplayer dang cai (Filter, EQ, Seek, Loop)
---

# ZiPlayer Installed API Signatures (Auto-extracted)

## index.d.ts
```ts
import { P as PlayerManager, a as Player } from './Player-TSHeQWxY.js';
export { A as ActiveStream, b as AntiStuckController, c as AntiStuckControllerOptions, d as AntiStuckReportRequest, e as AntiStuckRetryContext, f as AntiStuckRetryHandlers, g as AudioFilter, B as BaseExtension, h as BasePlugin, C as ConnectionController, i as ConnectionControllerOptions, j as ControllerCommandContext, k as ControllerCommandHandler, D as DEBUG_PRIORITY, E as ExtensionAfterPlayPayload, l as ExtensionContext, m as ExtensionControllerOptions, n as ExtensionManager, o as ExtensionPlayRequest, p as ExtensionPlayResponse, q as ExtensionSearchRequest, r as ExtensionStreamRequest, F as FilterControllerOptions, s as FilterControllerResourcePort, t as FilterControllerStreamType, u as ForwardControllerOptions, v as ForwardHealthStatus, L as LegacyAntiStuckRetryContext, w as LegacyAntiStuckRetryHandlers, x as LifecycleControllerOptions, y as LoopMode, M as ManagedStream, z as ManagerEvents, G as PREDEFINED_FILTERS, H as PlaybackController, I as PlaybackControllerOptions, J as PlaybackMirrorOptions, K as PlaybackMode, N as PlaybackOrchestrator, O as PlaybackOrchestratorAdapters, Q as PlaybackOrchestratorOptions, R as PlaybackPlayControllerOptions, S as PlaybackPreparationControllerOptions, T as PlaybackSession, U as PlaybackSessionController, V as PlaybackSessionSnapshot, W as PlaybackSessionStatus, X as PlaybackSkipControllerOptions, Y as PlaybackStartControllerOptions, Z as PlaybackTrackEndControllerOptions, _ as PlayerAction, $ as PlayerActionExecutionContext, a0 as PlayerActionMessage, a1 as PlayerActionPriority, a2 as PlayerActionType, a3 as PlayerBus, a4 as PlayerBusEvents, a5 as PlayerBusLatencyKind, a6 as PlayerBusLatencyRecord, a7 as PlayerBusLatencyTrace, a8 as PlayerBusRequestErrorReason, a9 as PlayerBusRpcContext, aa as PlayerBusRpcOptions, ab as PlayerConnectionBridgeOptions, ac as PlayerConnectionInput, ad as PlayerConnectionOutput, ae as PlayerDebugLevel, af as PlayerEvent, ag as PlayerEventArgsMap, ah as PlayerEventDebug, ai as PlayerEventDebugLogger, aj as PlayerEventTraceInfo, ak as PlayerEventType, al as PlayerEvents, am as PlayerInput, an as PlayerLifecycleEvents, ao as PlayerManagerOptions, ap as PlayerMessageContext, aq as PlayerOptions, ar as PlayerOutput, as as PlayerPlaybackEvents, at as PlayerPreloadEvents, au as PlayerPreloadInput, av as PlayerPreloadOutput, aw as PlayerPreloadState, ax as PlayerPublicEvents, ay as PlayerQuery, az as PlayerQueryHandler, aA as PlayerQueryMap, aB as PlayerQueueEvents, aC as PlayerRecoveryEvents, aD as PlayerRecoveryInput, aE as PlayerRecoveryOutput, aF as PlayerRequestId, aG as PlayerRequestInputType, aH as PlayerRequestOptions, aI as PlayerRequestProgress, aJ as PlayerRequestReply, aK as PlayerRequestReplyMap, aL as PlayerResourceInput, aM as PlayerResourceOutput, aN as PlayerRpcHandler, aO as PlayerRpcMap, aP as PlayerRpcOptions, aQ as PlayerRuntimeGraph, aR as PlayerSession, aS as PlayerSessionId, aT as PlayerStats, aU as PlayerVolumeEvents, aV as PluginControllerOptions, aW as PluginManager, aX as PluginManagerOptions, aY as PreloadController, aZ as PreloadControllerOptions, a_ as PreloadManager, a$ as PreloadState, b0 as ProgressBarOptions, b1 as PromotedPreload, b2 as Queue, b2 as QueueController, b3 as QueueControllerOptions, b4 as RelatedTracksOptions, b5 as ResourceRefreshControllerOptions, b6 as SEARCH_RPC_TYPES, b7 as SaveController, b8 as SaveControllerOptions, b9 as SaveOptions, ba as SaveVideoOptions, bb as SearchControllerOptions, bc as SearchDebugResult, bd as SearchRequest, be as SearchResult, bf as SearchScore, bg as SourceExtension, bh as SourcePlugin, bi as SourcePluginCtor, bj as SourcePluginLike, bk as StreamController, bl as StreamControllerOptions, bm as StreamInfo, bn as StreamManager, bo as StreamManagerOptions, bp as StreamSlot, bq as TTSControllerOptions, br as Track, bs as TrackAttemptQualityController, bt as TrackGetRecoveryCountRequest, bu as TrackLoadAttemptContext, bv as TrackLoadRequest, bw as TrackLoadResult, bx as TrackLoader, by as TrackLoaderContext, bz as TrackLoaderOptions, bA as TrackMiddleware, bB as TrackMiddlewareContext, bC as TrackRecoveryPolicy, bD as TrackResetRecoveryRequest, bE as TrackResolveContext, bF as TrackResolverOptions, bG as TrackStreamResolver, bH as TransitionBeatWaitRequest, bI as TransitionController, bJ as TransitionControllerOptions, bK as TransitionPlan, bL as TransitionPlanRequest, bM as TransitionPlanResponse, bN as TtsIsTTSRequest, bO as TtsPlayRequest, bP as VideoResolveOptions, bQ as VoiceChannel, bR as VolumeController, bS as VolumeControllerOptions, bT as VolumeSetRequest, bU as VolumeTargetRequest, bV as extractMediaId, bW as normalizeTrackMiddleware } from './Player-TSHeQWxY.js';
```

## Player-TSHeQWxY.d.ts
```ts
protected playerSkip(): Promise<void>;
paused: boolean;
beforePlay?(context: ExtensionContext, payload: ExtensionPlayRequest): Promise<ExtensionPlayResponse | void> | ExtensionPlayResponse | void;
provideSearch?(context: ExtensionContext, payload: ExtensionSearchRequest): Promise<SearchResult | null | undefined> | SearchResult | null | undefined;
provideStream?(context: ExtensionContext, payload: ExtensionStreamRequest): Promise<StreamInfo | null | undefined> | StreamInfo | null | undefined;
provideSearch(query: string, requestedBy: string, signal?: AbortSignal): Promise<SearchResult | null>;
beforePlayHooks(initial: ExtensionPlayRequest): Promise<{
request: ExtensionPlayRequest;
* Audio filter configuration for applying effects to audio streams.
* Based on FFmpeg audio filters for Discord music bots.
* // Bass boost filter
* const bassFilter: AudioFilter = {
*   name: "bassboost",
*   ffmpegFilter: "bass=g=10:f=110:w=0.5",
* // Nightcore filter (speed + pitch)
* const nightcoreFilter: AudioFilter = {
*   name: "nightcore",
*   ffmpegFilter: "atempo=1.25,asetrate=44100*1.25",
* // Custom filter
* const customFilter: AudioFilter = {
*   ffmpegFilter: "volume=1.5,treble=g=5",
interface AudioFilter {
/** Unique name identifier for the filter */
/** FFmpeg audio filter string */
ffmpegFilter: string;
/** Human-readable description of the filter */
/** Optional category for grouping filters */
/** Optional parameters for dynamic filter generation */
* Predefined audio filters commonly used in Discord music bots.
* These filters are based on popular FFmpeg audio filter combinations.
declare const PREDEFINED_FILTERS: Record<string, AudioFilter>;
markPaused(position?: number): void;
abstract search(query: string, requestedBy: string, signal?: AbortSignal): Promise<SearchResult>;
extractPlaylist?(url: string, requestedBy: string): Promise<Track[]>;
type PlayerRequestId = string;
readonly requestId: PlayerRequestId;
requestId?: PlayerRequestId;
type: "PAUSE";
requestId?: PlayerRequestId;
type: "RESUME";
requestId?: PlayerRequestId;
type: "SEEK";
requestId?: PlayerRequestId;
requestId?: PlayerRequestId;
type: "SKIP";
requestId?: PlayerRequestId;
requestId?: PlayerRequestId;
ignoreLoop?: boolean;
requestId?: PlayerRequestId;
requestId?: PlayerRequestId;
type: "FILTER_SET_SOURCE_TYPE";
requestId?: PlayerRequestId;
type: "FILTER_APPLY_AND_SEEK";
requestId?: PlayerRequestId;
requestId: PlayerRequestId;
requestId: PlayerRequestId;
requestId: PlayerRequestId;
type: "[Player]->[Preload]:request";
requestId: PlayerRequestId;
requestId: PlayerRequestId;
```

## BasePlugin.d.ts
```ts
export { h as BasePlugin } from '../Player-TSHeQWxY.js';
```

## index.d.ts
```ts
export { h as BasePlugin, aW as PluginManager, bV as extractMediaId } from '../Player-TSHeQWxY.js';
```
