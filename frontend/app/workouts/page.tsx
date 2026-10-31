"use client";

import { AppHeader } from "@/components/app-header";
import { ScheduleEditor } from "@/components/workouts/schedule-editor";
import { SessionForm } from "@/components/workouts/session-form";
import { SessionList } from "@/components/workouts/session-list";
import { TemplateFormView } from "@/components/workouts/template-form";
import { TemplateList } from "@/components/workouts/template-list";
import { useApi } from "@/hooks/use-api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import type { ScheduleDay, WorkoutSession, WorkoutTemplate } from "@/lib/types/api";

export default function WorkoutsPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const ready = profile.data !== null;
  const templates = useApi<WorkoutTemplate[]>(ready ? "/workouts/templates" : null);
  const schedule = useApi<ScheduleDay[]>(ready ? "/workouts/schedule" : null);
  const sessions = useApi<WorkoutSession[]>(ready ? "/workouts/sessions?limit=10" : null);

  if (loading || (!user && error?.status === 401) || (user && !profile.data && !profile.error)) {
    return <p className="m-auto text-muted-foreground">One moment…</p>;
  }
  if (!user) {
    return <p className="m-auto text-destructive">{error?.message ?? "Something went wrong."}</p>;
  }
  if (profile.error && profile.error.status !== 404) {
    return <p className="m-auto text-destructive">{profile.error.message}</p>;
  }
  if (!profile.data) {
    return <p className="m-auto text-muted-foreground">One moment…</p>;
  }

  const timeZone = profile.data.profile.timezone;
  const failure = templates.error ?? schedule.error ?? sessions.error;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />
      <h1 className="font-diary text-4xl">Workouts</h1>

      {failure && <p className="text-destructive">{failure.message}</p>}

      {templates.data && schedule.data && (
        // key: rebuild the editor after the templates or saved plan change, so it shows what's saved.
        <ScheduleEditor
          key={`${templates.data.length}-${JSON.stringify(schedule.data)}`}
          schedule={schedule.data}
          templates={templates.data}
          onSaved={schedule.reload}
        />
      )}
      {templates.data && <TemplateList templates={templates.data} />}
      <TemplateFormView onCreated={templates.reload} />
      {templates.data && (
        <SessionForm templates={templates.data} timeZone={timeZone} onSaved={sessions.reload} />
      )}
      {sessions.data && <SessionList sessions={sessions.data} timeZone={timeZone} />}
    </div>
  );
}
