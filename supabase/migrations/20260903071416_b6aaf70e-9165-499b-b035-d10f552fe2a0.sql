CREATE TABLE public.timesheet_months (
  month TEXT PRIMARY KEY,
  employee TEXT NOT NULL DEFAULT '',
  entries JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.timesheet_months TO anon;
GRANT ALL ON public.timesheet_months TO service_role;

ALTER TABLE public.timesheet_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jeder kann Monatszettel lesen" ON public.timesheet_months FOR SELECT TO anon USING (true);
CREATE POLICY "Jeder kann Monatszettel anlegen" ON public.timesheet_months FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Jeder kann Monatszettel bearbeiten" ON public.timesheet_months FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE TABLE public.timesheet_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_rate NUMERIC NOT NULL DEFAULT 13.90,
  overtime_rate NUMERIC NOT NULL DEFAULT 12.00,
  cap_hours NUMERIC NOT NULL DEFAULT 43,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.timesheet_settings (id) VALUES (1);

GRANT SELECT, UPDATE ON public.timesheet_settings TO anon;
GRANT ALL ON public.timesheet_settings TO service_role;

ALTER TABLE public.timesheet_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jeder kann Einstellungen lesen" ON public.timesheet_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Jeder kann Einstellungen bearbeiten" ON public.timesheet_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.timesheet_months;
ALTER PUBLICATION supabase_realtime ADD TABLE public.timesheet_settings;