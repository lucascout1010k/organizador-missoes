export const DASHBOARD_TIME_ZONE = "America/Sao_Paulo";
export const OPEN_MISSION_STATUSES = ["planned", "in_progress", "postponed"] as const;

export type MissionRow = {
  id: string;
  title: string;
  description: string | null;
  category: "academic" | "gym" | "project" | "personal";
  status: "planned" | "in_progress" | "postponed" | "missed" | "completed";
  priority: "high" | "medium" | "low";
  scheduled_for: string | null;
  due_at: string | null;
  estimated_minutes: number | null;
  origin_type: string | null;
  completed_at: string | null;
  created_at: string;
};

export type TodayMission = {
  id: string;
  title: string;
  description: string | null;
  priority: MissionRow["priority"];
  category: string;
  origin: string | null;
  estimatedMinutes: number | null;
  dateLabel: string | null;
  state: string;
  group: "overdue" | "today" | "completed";
};

export type TodayDashboard = {
  missions: TodayMission[];
  completed: number;
  total: number;
  percent: number;
  overdue: number;
};

function localDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

// Same IANA zone and offset strategy as the academic week; no browser authority.
export function todayRange(now = new Date()) {
  const day = localDate(now);
  const midnight = (calendar: Date) => {
    const date = calendar.toISOString().slice(0, 10);
    const offset = new Intl.DateTimeFormat("en-US", {
      timeZone: DASHBOARD_TIME_ZONE, timeZoneName: "longOffset",
    }).formatToParts(new Date(`${date}T12:00:00Z`))
      .find((part) => part.type === "timeZoneName")!.value.replace("GMT", "");
    return new Date(`${date}T00:00:00${offset}`).toISOString();
  };
  const calendar = new Date(`${day}T12:00:00Z`);
  const start = midnight(calendar);
  calendar.setUTCDate(calendar.getUTCDate() + 1);
  return { start, end: midnight(calendar) };
}

const categories = { academic: "Faculdade", gym: "Academia", project: "Projetos", personal: "Pessoal" };
const origins: Record<string, string> = {
  manual: "Manual", ai: "IA", pdf: "PDF", subject: "Matéria", class_session: "Aula", exam: "Prova",
};
const states = { planned: "Pendente", in_progress: "Em andamento", postponed: "Adiada", missed: "Não realizada", completed: "Concluída" };
const rank = { high: 0, medium: 1, low: 2 };

export function buildTodayDashboard(rows: MissionRow[], now = new Date()): TodayDashboard {
  const { start, end } = todayRange(now);
  const startMs = Date.parse(start), endMs = Date.parse(end);
  const inDay = (value: string | null) => value !== null && Date.parse(value) >= startMs && Date.parse(value) < endMs;
  const before = (value: string | null) => value !== null && Date.parse(value) < startMs;
  const relevant = rows.flatMap<{ row: MissionRow; group: TodayMission["group"] }>((row) => {
    if (row.status === "completed") return inDay(row.completed_at) ? [{ row, group: "completed" as const }] : [];
    if (!(OPEN_MISSION_STATUSES as readonly string[]).includes(row.status)) return [];
    if (before(row.due_at) || before(row.scheduled_for)) return [{ row, group: "overdue" as const }];
    if (inDay(row.scheduled_for) || inDay(row.due_at)) return [{ row, group: "today" as const }];
    return [];
  });
  const groups = { overdue: 0, today: 1, completed: 2 };
  const time = (row: MissionRow) => Math.min(...[row.scheduled_for, row.due_at, row.completed_at]
    .filter((value): value is string => value !== null).map(Date.parse));
  relevant.sort((a, b) => groups[a.group] - groups[b.group] || rank[a.row.priority] - rank[b.row.priority]
    || time(a.row) - time(b.row)
    || a.row.created_at.localeCompare(b.row.created_at) || a.row.id.localeCompare(b.row.id));
  const formatDate = (date: string) => new Intl.DateTimeFormat("pt-BR", {
    timeZone: DASHBOARD_TIME_ZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
  const missions = relevant.map(({ row, group }): TodayMission => {
    const dates = group === "completed" ? [`Concluída em ${formatDate(row.completed_at!)}`] : [
      row.scheduled_for ? `Agendada ${formatDate(row.scheduled_for)}` : null,
      row.due_at ? `Prazo ${formatDate(row.due_at)}` : null,
    ];
    return {
      id: row.id, title: row.title, description: row.description?.slice(0, 240) ?? null,
      priority: row.priority, category: categories[row.category], origin: row.origin_type ? origins[row.origin_type] ?? null : null,
      estimatedMinutes: row.estimated_minutes, state: states[row.status], group,
      dateLabel: dates.filter(Boolean).join(" · ") || null,
    };
  });
  const completed = missions.filter((mission) => mission.group === "completed").length;
  return { missions, completed, total: missions.length,
    percent: missions.length ? Math.round(completed / missions.length * 100) : 0,
    overdue: missions.filter((mission) => mission.group === "overdue").length };
}
