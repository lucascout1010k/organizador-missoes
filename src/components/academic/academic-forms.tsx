import {
  createClassSession,
  createCourse,
  createExam,
  createPeriod,
  createSubject,
  updateClassSession,
  updateCourse,
  updateExam,
  updatePeriod,
  updateSubject,
} from "@/app/(protected)/faculdade/actions";
import type {
  AcademicCourse,
  AcademicPeriod,
  ClassSession,
  Exam,
  Subject,
} from "@/lib/academic/types";
import {
  courseStatusLabels,
  eventStatusLabels,
  periodStatusLabels,
  subjectStatusLabels,
} from "@/lib/academic/types";

import { ActionForm } from "./action-form";
import { DateTimeField } from "./date-time-field";

function StatusSelect({
  defaultValue,
  id,
  label = "Status",
  options,
}: {
  defaultValue: string;
  id: string;
  label?: string;
  options: Record<string, string>;
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select defaultValue={defaultValue} id={id} name="status">
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>{text}</option>
        ))}
      </select>
    </label>
  );
}

export function CourseForm({ course }: { course?: AcademicCourse }) {
  const prefix = course?.id ?? "new-course";
  const action = course ? updateCourse.bind(null, course.id) : createCourse;

  return (
    <ActionForm action={action} submitLabel={course ? "Salvar curso" : "Criar curso"} version={course?.updated_at}>
      <label className="field field-wide" htmlFor={`${prefix}-name`}>
        <span>Nome do curso</span>
        <input
          defaultValue={course?.name}
          id={`${prefix}-name`}
          maxLength={200}
          name="name"
          placeholder="Ex.: Curso Teste"
          required
        />
      </label>
      <StatusSelect
        defaultValue={course?.status ?? "active"}
        id={`${prefix}-status`}
        options={courseStatusLabels}
      />
    </ActionForm>
  );
}

export function PeriodForm({
  courseId,
  period,
}: {
  courseId: string;
  period?: AcademicPeriod;
}) {
  const prefix = period?.id ?? `new-period-${courseId}`;
  const action = period
    ? updatePeriod.bind(null, period.id)
    : createPeriod.bind(null, courseId);

  return (
    <ActionForm action={action} submitLabel={period ? "Salvar período" : "Criar período"} version={period?.updated_at}>
      <label className="field field-wide" htmlFor={`${prefix}-name`}>
        <span>Nome do período</span>
        <input defaultValue={period?.name} id={`${prefix}-name`} maxLength={200} name="name" placeholder="Ex.: 1º período" required />
      </label>
      <label className="field" htmlFor={`${prefix}-number`}>
        <span>Número</span>
        <input defaultValue={period?.period_number ?? ""} id={`${prefix}-number`} max={32767} min={1} name="period_number" type="number" />
      </label>
      <label className="field" htmlFor={`${prefix}-year`}>
        <span>Ano</span>
        <input defaultValue={period?.year ?? ""} id={`${prefix}-year`} max={9999} min={1} name="year" type="number" />
      </label>
      <label className="field" htmlFor={`${prefix}-term`}>
        <span>Termo</span>
        <input defaultValue={period?.term ?? ""} id={`${prefix}-term`} maxLength={100} name="term" placeholder="Ex.: 1º semestre" />
      </label>
      <StatusSelect defaultValue={period?.status ?? "planned"} id={`${prefix}-status`} options={periodStatusLabels} />
      <label className="field" htmlFor={`${prefix}-start`}>
        <span>Data inicial</span>
        <input defaultValue={period?.start_date ?? ""} id={`${prefix}-start`} name="start_date" type="date" />
      </label>
      <label className="field" htmlFor={`${prefix}-end`}>
        <span>Data final</span>
        <input defaultValue={period?.end_date ?? ""} id={`${prefix}-end`} name="end_date" type="date" />
      </label>
    </ActionForm>
  );
}

export function SubjectForm({
  periodId,
  subject,
}: {
  periodId: string;
  subject?: Subject;
}) {
  const prefix = subject?.id ?? `new-subject-${periodId}`;
  const action = subject
    ? updateSubject.bind(null, subject.id, periodId)
    : createSubject.bind(null, periodId);

  return (
    <ActionForm action={action} submitLabel={subject ? "Salvar matéria" : "Criar matéria"} version={subject?.updated_at}>
      <label className="field field-wide" htmlFor={`${prefix}-name`}>
        <span>Nome da matéria</span>
        <input defaultValue={subject?.name} id={`${prefix}-name`} maxLength={200} name="name" placeholder="Ex.: Matéria Teste" required />
      </label>
      <label className="field" htmlFor={`${prefix}-code`}>
        <span>Código (opcional)</span>
        <input defaultValue={subject?.code ?? ""} id={`${prefix}-code`} maxLength={50} name="code" placeholder="EX-101" />
      </label>
      <StatusSelect defaultValue={subject?.status ?? "active"} id={`${prefix}-status`} options={subjectStatusLabels} />
    </ActionForm>
  );
}

export function ClassSessionForm({
  classSession,
  subjectId,
}: {
  classSession?: ClassSession;
  subjectId: string;
}) {
  const prefix = classSession?.id ?? `new-class-${subjectId}`;
  const action = classSession
    ? updateClassSession.bind(null, classSession.id, subjectId)
    : createClassSession.bind(null, subjectId);

  return (
    <ActionForm action={action} submitLabel={classSession ? "Salvar aula" : "Cadastrar aula"} version={classSession?.updated_at}>
      <label className="field field-wide" htmlFor={`${prefix}-title`}>
        <span>Título</span>
        <input defaultValue={classSession?.title} id={`${prefix}-title`} maxLength={200} name="title" placeholder="Ex.: Aula Teste" required />
      </label>
      <DateTimeField id={`${prefix}-date`} initialIso={classSession?.class_date} label="Data e hora" name="class_date" />
      <StatusSelect defaultValue={classSession?.status ?? "planned"} id={`${prefix}-status`} options={eventStatusLabels} />
      <label className="field field-wide" htmlFor={`${prefix}-notes`}>
        <span>Notas</span>
        <textarea defaultValue={classSession?.notes ?? ""} id={`${prefix}-notes`} maxLength={20000} name="notes" placeholder="Anotações da aula…" rows={4} />
      </label>
    </ActionForm>
  );
}

export function ExamForm({ exam, subjectId }: { exam?: Exam; subjectId: string }) {
  const prefix = exam?.id ?? `new-exam-${subjectId}`;
  const action = exam
    ? updateExam.bind(null, exam.id, subjectId)
    : createExam.bind(null, subjectId);

  return (
    <ActionForm action={action} submitLabel={exam ? "Salvar prova" : "Cadastrar prova"} version={exam?.updated_at}>
      <label className="field field-wide" htmlFor={`${prefix}-title`}>
        <span>Título</span>
        <input defaultValue={exam?.title} id={`${prefix}-title`} maxLength={200} name="title" placeholder="Ex.: Prova Teste" required />
      </label>
      <DateTimeField id={`${prefix}-date`} initialIso={exam?.exam_date} label="Data e hora" name="exam_date" />
      <StatusSelect defaultValue={exam?.status ?? "planned"} id={`${prefix}-status`} options={eventStatusLabels} />
      <label className="field field-wide" htmlFor={`${prefix}-topics`}>
        <span>Assuntos (um por linha)</span>
        <textarea defaultValue={exam?.topics.join("\n") ?? ""} id={`${prefix}-topics`} maxLength={25000} name="topics" placeholder={"Assunto 1\nAssunto 2"} rows={5} />
      </label>
      <label className="field field-wide" htmlFor={`${prefix}-notes`}>
        <span>Observações</span>
        <textarea defaultValue={exam?.notes ?? ""} id={`${prefix}-notes`} maxLength={20000} name="notes" placeholder="Observações sobre a prova…" rows={4} />
      </label>
    </ActionForm>
  );
}
