-- Voice-memo storage bucket — walkthrough M6.
--
-- The 20260724090000 migration created `booking_voice_notes` (the row) but not
-- the place the audio actually lives, because capture was stubbed at the time.
-- expo-audio landed 2026-07-25, so this adds the bucket.
--
-- PRIVATE, deliberately. `job-photos` is public-read, and that was already
-- called out as the worst item in the walkthrough audit (L3: client photos are
-- "a burglary recon tool"). A proof-of-work memo is a business narrating the
-- inside of somebody's home — same exposure, in audio. Nothing in this bucket
-- is reachable without a signed URL minted per read by the API
-- (`uploads.sign_audio_path`, 1 h TTL).
--
-- No storage RLS policies are added on purpose: with the bucket private and no
-- policy granting `anon`/`authenticated` anything, only the backend's
-- service_role key can read or write it. Signed URLs bypass RLS by design, so
-- playback still works for the client and the business on a booking.
--
-- Applied to prod 2026-07-25 (bucket verified via storage.buckets).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'voice-notes',
    'voice-notes',
    false,
    8388608,  -- 8 MB; a 60 s AAC memo is well under 2 MB
    array[
        'audio/mp4',    -- Android MediaRecorder .m4a container
        'audio/m4a',
        'audio/x-m4a',  -- iOS AVAudioRecorder .m4a
        'audio/aac',
        'audio/mpeg',
        'audio/wav',
        'audio/x-wav'
    ]
)
on conflict (id) do update
    set public            = excluded.public,
        file_size_limit   = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
