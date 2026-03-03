import { useState } from "react";
import { useAppDispatch } from "../../app/hooks";
import { closeForm } from "./habitsSlice";
import { useCreateHabitMutation } from "./habitsApi";
import { HABIT_COLORS, HABIT_CATEGORIES } from "@habit-tracker/shared";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const DIFFICULTIES = [
  { value: "easy",   label: "Easy",   xp: 5,  color: "border-green-600  text-green-400  bg-green-950" },
  { value: "medium", label: "Medium", xp: 10, color: "border-blue-600   text-blue-400   bg-blue-950"  },
  { value: "hard",   label: "Hard",   xp: 20, color: "border-purple-600 text-purple-400 bg-purple-950" },
  { value: "expert", label: "Expert", xp: 40, color: "border-amber-600  text-amber-400  bg-amber-950"  },
];

const FREQUENCIES = [
  { value: "daily",  label: "Daily"  },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
];

export default function HabitForm() {
  const dispatch = useAppDispatch();
  const [createHabit, { isLoading, error }] = useCreateHabitMutation();

  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory]       = useState("health");
  const [frequency, setFrequency]     = useState("daily");
  const [difficulty, setDifficulty]   = useState("medium");
  const [color, setColor]             = useState(HABIT_COLORS[4]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createHabit({
        title,
        description: description || undefined,
        category,
        frequency,
        difficulty,
        color,
      }).unwrap();
      dispatch(closeForm());
    } catch {
      // error surfaced via the `error` variable
    }
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
      <h2 className="mb-5 text-lg font-bold text-slate-100">New Habit</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Morning run"
          required
          maxLength={100}
        />

        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why does this habit matter?"
        />

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-slate-300">Category</legend>
          <div className="flex flex-wrap gap-1.5">
            {HABIT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                  category === c
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-200",
                ].join(" ")}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-slate-300">Frequency</legend>
          <div className="flex gap-2">
            {FREQUENCIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFrequency(value)}
                className={[
                  "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                  frequency === value
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-200",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-slate-300">Difficulty</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {DIFFICULTIES.map(({ value, label, xp, color: dc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDifficulty(value)}
                className={[
                  "flex flex-col items-center rounded-lg border py-2 transition-all",
                  difficulty === value ? dc : "border-slate-700 bg-slate-800 text-slate-500",
                ].join(" ")}
              >
                <span className="text-xs font-semibold">{label}</span>
                <span className="text-[10px] opacity-70">+{xp} XP</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-slate-300">Color</legend>
          <div className="flex gap-2">
            {HABIT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={[
                  "h-7 w-7 rounded-full border-2 transition-all hover:scale-110",
                  color === c ? "border-white scale-110" : "border-transparent",
                ].join(" ")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-400">
            {error?.data?.message ?? "Failed to create habit"}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="submit" isLoading={isLoading} loadingText="Saving…">
            Save Habit
          </Button>
          <Button type="button" variant="ghost" onClick={() => dispatch(closeForm())}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

const DIFFICULTIES: { value: HabitDifficulty; label: string; xp: number; color: string }[] = [
  { value: "easy",   label: "Easy",   xp: 5,  color: "border-green-600  text-green-400  bg-green-950" },
  { value: "medium", label: "Medium", xp: 10, color: "border-blue-600   text-blue-400   bg-blue-950"  },
  { value: "hard",   label: "Hard",   xp: 20, color: "border-purple-600 text-purple-400 bg-purple-950" },
  { value: "expert", label: "Expert", xp: 40, color: "border-amber-600  text-amber-400  bg-amber-950"  },
];

const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: "daily",  label: "Daily"  },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
];

export default function HabitForm() {
  const dispatch = useAppDispatch();
  const [createHabit, { isLoading, error }] = useCreateHabitMutation();

  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory]     = useState<HabitCategory>("health");
  const [frequency, setFrequency]   = useState<HabitFrequency>("daily");
  const [difficulty, setDifficulty] = useState<HabitDifficulty>("medium");
  const [color, setColor]           = useState(HABIT_COLORS[4]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createHabit({
        title,
        description: description || undefined,
        category,
        frequency,
        difficulty,
        color,
      }).unwrap();
      dispatch(closeForm());
    } catch {
      // error surfaced via the `error` variable
    }
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
      <h2 className="mb-5 text-lg font-bold text-slate-100">New Habit</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Morning run"
          required
          maxLength={100}
        />

        {/* Description */}
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why does this habit matter?"
        />

        {/* Category */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-slate-300">Category</legend>
          <div className="flex flex-wrap gap-1.5">
            {(HABIT_CATEGORIES as HabitCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                  category === c
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-200",
                ].join(" ")}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Frequency */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-slate-300">Frequency</legend>
          <div className="flex gap-2">
            {FREQUENCIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFrequency(value)}
                className={[
                  "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                  frequency === value
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-200",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Difficulty */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-slate-300">Difficulty</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {DIFFICULTIES.map(({ value, label, xp, color: dc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDifficulty(value)}
                className={[
                  "flex flex-col items-center rounded-lg border py-2 transition-all",
                  difficulty === value ? dc : "border-slate-700 bg-slate-800 text-slate-500",
                ].join(" ")}
              >
                <span className="text-xs font-semibold">{label}</span>
                <span className="text-[10px] opacity-70">+{xp} XP</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Color */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-slate-300">Color</legend>
          <div className="flex gap-2">
            {HABIT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={[
                  "h-7 w-7 rounded-full border-2 transition-all hover:scale-110",
                  color === c ? "border-white scale-110" : "border-transparent",
                ].join(" ")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>

        {/* Error */}
        {error && (
          <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-400">
            {"data" in error
              ? (error.data as { message?: string })?.message
              : "Failed to create habit"}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button type="submit" isLoading={isLoading} loadingText="Saving…">
            Save Habit
          </Button>
          <Button type="button" variant="ghost" onClick={() => dispatch(closeForm())}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

