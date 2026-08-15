# LiveKit voice engine migration

## Goal
Replace the hand-built peer-to-peer WebRTC mesh with LiveKit Cloud while preserving the existing Voxar.app voice-channel layout, HUD controls, camera, screen sharing, and route-independent call session.

## Implementation
1. **Install the LiveKit SDKs**
   - Add `livekit-client` and `@livekit/components-react`.
   - Keep LiveKit credentials out of the browser bundle.

2. **Add secure connection-token issuance**
   - Create an authenticated backend function that validates the signed-in user and confirms they belong to the guild containing the requested voice channel.
   - Generate a short-lived LiveKit room token using `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`.
   - Grant only room join, publish, subscribe, and data permissions for that channel’s deterministic LiveKit room.

3. **Replace the raw WebRTC engine**
   - Rebuild `useVoxVoice` around one persistent LiveKit `Room` supplied through the React LiveKit room context.
   - Remove manual offers, answers, ICE queues, peer reconnection timers, browser-created audio elements, and realtime signaling broadcasts.
   - Use LiveKit connection and participant events for connected/connecting state, reconnects, active speakers, remote tracks, and disconnect cleanup.
   - Keep the current public voice API so the surrounding application needs minimal changes.

4. **Migrate media controls**
   - Route mute, camera, quality changes, and screen sharing through LiveKit publication APIs.
   - Preserve the desktop screen-source picker and browser screen picker behavior.
   - Render subscribed room audio with LiveKit’s audio renderer and build video tiles from LiveKit track publications.

5. **Make LiveKit the presence source of truth**
   - Drive the open voice view from actual LiveKit participants so disconnected users disappear immediately.
   - Continue syncing the existing participant table only as lightweight metadata for channel/sidebar previews, with heartbeat cleanup retained as a fallback.

6. **Preserve and verify the HUD**
   - Keep the current dark chamfered controls and Czech status/error messages.
   - Verify join, leave, microphone mute, camera, screen sharing, participant removal, failed-token handling, and navigation while connected.

## Technical notes
- Room name: deterministic from the voice-channel UUID; raw room names and API secrets are never accepted from the client.
- Identity: authenticated user ID; display name comes from the backend profile.
- No mock transport is used: the configured LiveKit Cloud project provides the SFU, signaling, STUN, and TURN infrastructure.