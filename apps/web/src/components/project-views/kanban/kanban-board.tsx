import type { Task } from "@/hooks/use-tasks";
import { useMoveTask, useTasks } from "@/hooks/use-tasks";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";

type Status = { id: string; name: string; color: string };

type Props = {
  projectId: string;
  statuses: Status[];
  onTaskClick?: (taskId: string) => void;
};

export function KanbanBoard({ projectId, statuses, onTaskClick }: Props) {
  const { data: tasks = [] } = useTasks(projectId);
  const moveTask = useMoveTask();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Determine target status and position
    const targetStatus =
      statuses.find((s) =>
        tasks.filter((t) => t.statusId === s.id).some((t) => t.id === overId),
      ) || statuses.find((s) => s.id === overId);

    if (!targetStatus) return;

    const columnTasks = tasks.filter((t) => t.statusId === targetStatus.id);
    const overIndex = columnTasks.findIndex((t) => t.id === overId);
    const newOrder = overIndex >= 0 ? overIndex : columnTasks.length;

    moveTask.mutate({
      id: taskId,
      statusId: targetStatus.id,
      order: newOrder,
    });
  };

  // Group tasks by status
  const tasksByStatus = statuses.reduce(
    (acc, status) => {
      acc[status.id] = tasks.filter((t) => t.statusId === status.id);
      return acc;
    },
    {} as Record<string, typeof tasks>,
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 overflow-x-auto pb-4 h-full snap-x">
        {statuses.map((status) => (
          <div key={status.id} className="snap-start h-full">
            <KanbanColumn
              status={status}
              tasks={tasksByStatus[status.id] ?? []}
              projectId={projectId}
              onTaskClick={onTaskClick}
            />
          </div>
        ))}
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 250,
          easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
        }}
      >
        {activeTask && (
          <div className="opacity-90 rotate-2 scale-105 cursor-grabbing">
            <TaskCard task={activeTask} isDragOverlay />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
