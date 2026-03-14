import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { Button } from "../../components/ui/Button";
import {
  setTodoFilter,
  selectTodoFilter,
} from "./todosSlice";
import {
  useGetTodosQuery,
  useCreateTodoMutation,
  useUpdateTodoMutation,
  useToggleTodoMutation,
  useDeleteTodoMutation,
  useClearCompletedTodosMutation,
} from "./todosApi";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

function TodoItem({ todo, onToggle, onDelete, onRename }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(todo.title);
      setIsEditing(false);
      return;
    }

    if (trimmed !== todo.title) {
      onRename(todo._id, trimmed);
    }
    setIsEditing(false);
  };

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo._id)}
          className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
          aria-label={`Mark ${todo.title} as ${todo.completed ? "not completed" : "completed"}`}
        />

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") {
                  setDraft(todo.title);
                  setIsEditing(false);
                }
              }}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={[
                "w-full text-left text-sm text-slate-100",
                todo.completed ? "text-slate-500 line-through" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title="Click to edit"
            >
              {todo.title}
            </button>
          )}

          <p className="mt-1 text-xs text-slate-500">
            Added {new Date(todo.createdAt).toLocaleDateString()}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onDelete(todo._id)}
          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-800 hover:text-red-300"
          aria-label={`Delete ${todo.title}`}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

TodoItem.propTypes = {
  todo: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    completed: PropTypes.bool.isRequired,
    createdAt: PropTypes.string.isRequired,
  }).isRequired,
  onToggle: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
};

export default function TodoPage() {
  const dispatch = useAppDispatch();
  const filter = useAppSelector(selectTodoFilter);

  const {
    data: todos = [],
    isLoading,
    isError,
    refetch,
  } = useGetTodosQuery();

  const [createTodo, { isLoading: isCreating }] = useCreateTodoMutation();
  const [updateTodo] = useUpdateTodoMutation();
  const [toggleTodo] = useToggleTodoMutation();
  const [deleteTodo] = useDeleteTodoMutation();
  const [clearCompletedTodos, { isLoading: isClearingCompleted }] =
    useClearCompletedTodosMutation();

  const [newTodo, setNewTodo] = useState("");

  const visibleTodos = useMemo(() => {
    if (filter === "active") return todos.filter((item) => !item.completed);
    if (filter === "completed") return todos.filter((item) => item.completed);
    return todos;
  }, [todos, filter]);

  const stats = useMemo(() => {
    const completed = todos.filter((item) => item.completed).length;
    const active = todos.length - completed;
    return { total: todos.length, active, completed };
  }, [todos]);

  const isSubmitDisabled = newTodo.trim().length === 0 || isCreating;

  const progress = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  }, [stats.completed, stats.total]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const title = newTodo.trim();
    if (!title) return;

    try {
      await createTodo({ title }).unwrap();
      setNewTodo("");
    } catch {
      // Keep input value so user can retry if the request fails.
    }
  };

  let listContent = null;
  if (isLoading) {
    listContent = (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-10 text-center">
        <p className="text-sm text-slate-400">Loading todos...</p>
      </div>
    );
  } else if (visibleTodos.length > 0) {
    listContent = (
      <ul className="space-y-2" aria-label="Todo list">
        {visibleTodos.map((todo) => (
          <TodoItem
            key={todo._id}
            todo={todo}
            onToggle={(id) => toggleTodo(id)}
            onDelete={(id) => deleteTodo(id)}
            onRename={(id, title) => updateTodo({ id, body: { title } })}
          />
        ))}
      </ul>
    );
  } else {
    listContent = (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-10 text-center">
        <p className="text-sm text-slate-400">
          {filter === "all"
            ? "No tasks yet. Add one above to get started."
            : `No ${filter} tasks right now.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Todo List</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track quick tasks alongside your long-term habits.
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
          <span>{stats.completed}/{stats.total} done</span>
          <span className="mx-2 text-slate-600">|</span>
          <span>{progress}% complete</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="rounded-xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a task (e.g. Plan tomorrow's top 3 priorities)"
            className="h-10 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button type="submit" disabled={isSubmitDisabled} isLoading={isCreating}>
            Add Task
          </Button>
        </div>
      </form>

      {isError && (
        <div className="flex items-center justify-between rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3">
          <p className="text-sm text-red-400">Failed to load todos.</p>
          <button
            type="button"
            onClick={refetch}
            className="text-sm font-medium text-red-300 transition-colors hover:text-red-100"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => dispatch(setTodoFilter(item.value))}
            className={[
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filter === item.value
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {item.label}
          </button>
        ))}

        <div className="ml-auto text-xs text-slate-500">
          {stats.active} active, {stats.completed} completed
        </div>
      </div>

      {listContent}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clearCompletedTodos()}
          disabled={stats.completed === 0 || isClearingCompleted}
          isLoading={isClearingCompleted}
        >
          Clear Completed
        </Button>
      </div>
    </div>
  );
}
