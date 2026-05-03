-- Betrouwbaardere Realtime UPDATE-events voor leerling (status on_way).
-- Optioneel maar aanbevolen als de leerling de melding niet live ziet.

ALTER TABLE public.student_help_requests REPLICA IDENTITY FULL;
