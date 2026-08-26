import Link from "next/link";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { DOCUMENT_KINDS, EQUIPMENT } from "@/lib/enums";
import { formatDate, daysUntil } from "@/lib/format";
import {
  createArea,
  createBirthday,
  createClient,
  createDocument,
  createExercise,
  createShipLog,
  deleteArea,
  deleteBirthday,
  deleteClient,
  deleteDocument,
  deleteExercise,
  deleteShipLog,
} from "./actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "areas", label: "Areas" },
  { key: "clients", label: "Clients" },
  { key: "documents", label: "Documents" },
  { key: "people", label: "Birthdays" },
  { key: "exercises", label: "Exercises" },
  { key: "shipped", label: "Shipped" },
];

/** Small delete button used by every list below. */
function DeleteButton({
  action,
  id,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
}) {
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={label}
        className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
      >
        ✕
      </button>
    </form>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await verifySession();

  const params = await searchParams;
  const tab = TABS.some((t) => t.key === params.tab) ? params.tab! : "areas";

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">The reference data every other tab draws on.</p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map((entry) => (
          <Link
            key={entry.key}
            href={`/settings?tab=${entry.key}`}
            className={`btn-ghost px-3 py-1 text-xs ${
              tab === entry.key ? "bg-accent/15 text-accent" : ""
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      {tab === "areas" && <AreasSection />}
      {tab === "clients" && <ClientsSection />}
      {tab === "documents" && <DocumentsSection />}
      {tab === "people" && <BirthdaysSection />}
      {tab === "exercises" && <ExercisesSection />}
      {tab === "shipped" && <ShippedSection />}
    </div>
  );
}

// ---------------------------------------------------------------------------

async function AreasSection() {
  const areas = await prisma.area.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <section className="mt-6 flex flex-col gap-2">
        {areas.length === 0 && <EmptyState message="No areas yet." />}
        {areas.map((area) => (
          <div key={area.id} className="card flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-2 text-sm">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: area.color }}
                aria-hidden="true"
              />
              <span className="text-foreground">
                {area.icon} {area.name}
              </span>
            </span>
            <DeleteButton action={deleteArea} id={area.id} label={`Delete ${area.name}`} />
          </div>
        ))}
      </section>

      <p className="mt-3 text-xs text-faint-foreground">
        Deleting an area un-tags whatever used it — nothing else is removed.
      </p>

      <form action={createArea} className="card mt-6 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="field-label">
            Name
          </label>
          <input id="name" name="name" required className="input mt-1" />
        </div>
        <div>
          <label htmlFor="icon" className="field-label">
            Icon
          </label>
          <input id="icon" name="icon" maxLength={4} className="input mt-1" placeholder="💼" />
        </div>
        <div>
          <label htmlFor="color" className="field-label">
            Colour
          </label>
          <input
            id="color"
            name="color"
            type="color"
            defaultValue="#4f8cff"
            className="input mt-1 h-9 p-1"
          />
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary">
            Add area
          </button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------

async function ClientsSection() {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <section className="mt-6 flex flex-col gap-2">
        {clients.length === 0 && <EmptyState message="No clients yet." />}
        {clients.map((client) => (
          <div key={client.id} className="card flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-2 text-sm">
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: `${client.color}26`, color: client.color }}
              >
                {client.shortCode}
              </span>
              <span className="text-foreground">{client.name}</span>
            </span>
            <DeleteButton action={deleteClient} id={client.id} label={`Delete ${client.name}`} />
          </div>
        ))}
      </section>

      <form action={createClient} className="card mt-6 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="field-label">
            Name
          </label>
          <input id="name" name="name" required className="input mt-1" />
        </div>
        <div>
          <label htmlFor="shortCode" className="field-label">
            Short code
          </label>
          <input
            id="shortCode"
            name="shortCode"
            required
            maxLength={4}
            className="input mt-1"
            placeholder="PB"
          />
        </div>
        <div>
          <label htmlFor="color" className="field-label">
            Colour
          </label>
          <input
            id="color"
            name="color"
            type="color"
            defaultValue="#4f8cff"
            className="input mt-1 h-9 p-1"
          />
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary">
            Add client
          </button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------

async function DocumentsSection() {
  const documents = await prisma.document.findMany({ orderBy: { expiresAt: "asc" } });

  return (
    <>
      <section className="mt-6 flex flex-col gap-2">
        {documents.length === 0 && <EmptyState message="No documents tracked." />}
        {documents.map((document) => {
          const days = document.expiresAt ? daysUntil(document.expiresAt) : null;
          return (
            <div key={document.id} className="card flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <span className="block truncate text-sm text-foreground">{document.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {document.kind}
                  {document.expiresAt && ` · expires ${formatDate(document.expiresAt)}`}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {days !== null && (
                  <span
                    className={`tnum text-sm font-semibold ${days < 60 ? "text-danger" : "text-foreground"}`}
                  >
                    {days}d
                  </span>
                )}
                <DeleteButton
                  action={deleteDocument}
                  id={document.id}
                  label={`Delete ${document.name}`}
                />
              </div>
            </div>
          );
        })}
      </section>

      <form action={createDocument} className="card mt-6 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="field-label">
            Name
          </label>
          <input id="name" name="name" required className="input mt-1" />
        </div>
        <div>
          <label htmlFor="kind" className="field-label">
            Kind
          </label>
          <select id="kind" name="kind" className="input mt-1" defaultValue="other">
            {DOCUMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="expiresAt" className="field-label">
            Expires
          </label>
          <input id="expiresAt" name="expiresAt" type="date" className="input mt-1" />
        </div>
        <div className="sm:col-span-4">
          <label htmlFor="notes" className="field-label">
            Notes
          </label>
          <input id="notes" name="notes" className="input mt-1" />
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary">
            Add document
          </button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------

async function BirthdaysSection() {
  const birthdays = await prisma.birthday.findMany({ orderBy: [{ month: "asc" }, { day: "asc" }] });

  return (
    <>
      <section className="mt-6 flex flex-col gap-2">
        {birthdays.length === 0 && <EmptyState message="No birthdays tracked." />}
        {birthdays.map((birthday) => (
          <div key={birthday.id} className="card flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-foreground">
              {birthday.name}
              <span className="ml-2 text-[11px] text-muted-foreground">
                {birthday.month}/{birthday.day}
                {birthday.birthYear && ` · ${birthday.birthYear}`}
              </span>
            </span>
            <DeleteButton
              action={deleteBirthday}
              id={birthday.id}
              label={`Delete ${birthday.name}`}
            />
          </div>
        ))}
      </section>

      <form action={createBirthday} className="card mt-6 grid gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="name" className="field-label">
            Name
          </label>
          <input id="name" name="name" required className="input mt-1" />
        </div>
        <div>
          <label htmlFor="month" className="field-label">
            Month
          </label>
          <input
            id="month"
            name="month"
            type="number"
            min={1}
            max={12}
            required
            className="input mt-1"
          />
        </div>
        <div>
          <label htmlFor="day" className="field-label">
            Day
          </label>
          <input id="day" name="day" type="number" min={1} max={31} required className="input mt-1" />
        </div>
        <div>
          <label htmlFor="birthYear" className="field-label">
            Birth year
          </label>
          <input id="birthYear" name="birthYear" type="number" className="input mt-1" />
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary">
            Add birthday
          </button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------

async function ExercisesSection() {
  const exercises = await prisma.exercise.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <section className="mt-6 grid gap-2 sm:grid-cols-2">
        {exercises.length === 0 && (
          <div className="sm:col-span-2">
            <EmptyState message="No exercises in the library." />
          </div>
        )}
        {exercises.map((exercise) => (
          <div key={exercise.id} className="card flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <span className="block truncate text-sm text-foreground">{exercise.name}</span>
              <span className="text-[11px] text-muted-foreground">
                {exercise.equipment}
                {exercise.muscleGroup && ` · ${exercise.muscleGroup}`}
              </span>
            </div>
            <DeleteButton
              action={deleteExercise}
              id={exercise.id}
              label={`Delete ${exercise.name}`}
            />
          </div>
        ))}
      </section>

      <p className="mt-3 text-xs text-faint-foreground">
        Deleting an exercise also deletes every set ever logged against it.
      </p>

      <form action={createExercise} className="card mt-6 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="name" className="field-label">
            Name
          </label>
          <input id="name" name="name" required className="input mt-1" />
        </div>
        <div>
          <label htmlFor="equipment" className="field-label">
            Equipment
          </label>
          <select id="equipment" name="equipment" className="input mt-1" defaultValue="barbell">
            {EQUIPMENT.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="muscleGroup" className="field-label">
            Muscle group
          </label>
          <input id="muscleGroup" name="muscleGroup" className="input mt-1" placeholder="Chest" />
        </div>
        <div className="sm:col-span-3">
          <button type="submit" className="btn-primary">
            Add exercise
          </button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------

async function ShippedSection() {
  const ships = await prisma.shipLog.findMany({ orderBy: { shippedAt: "desc" } });

  return (
    <>
      <section className="mt-6 flex flex-col gap-2">
        {ships.length === 0 && <EmptyState message="Nothing logged yet." />}
        {ships.map((ship) => (
          <div key={ship.id} className="card flex items-center justify-between gap-3 py-3">
            <span className="min-w-0 truncate text-sm text-foreground">{ship.title}</span>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted-foreground">{formatDate(ship.shippedAt)}</span>
              <DeleteButton action={deleteShipLog} id={ship.id} label={`Delete ${ship.title}`} />
            </div>
          </div>
        ))}
      </section>

      <form action={createShipLog} className="card mt-6 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-3">
          <label htmlFor="title" className="field-label">
            What shipped
          </label>
          <input id="title" name="title" required className="input mt-1" />
        </div>
        <div>
          <label htmlFor="shippedAt" className="field-label">
            Date
          </label>
          <input id="shippedAt" name="shippedAt" type="date" className="input mt-1" />
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary">
            Log it
          </button>
        </div>
      </form>
    </>
  );
}
