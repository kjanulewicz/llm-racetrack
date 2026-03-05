import ModelSlotCard from "./ModelSlotCard";

const MIN_SLOTS = 2;
const MAX_SLOTS = 4;

/**
 * Horizontal slot row — arcade "player select" layout.
 * Enforces min 2 / max 4 active slots.
 * Opens AddModelModal on + click.
 *
 * @param {{
 *   models: Array<{ id: string, label: string, provider: string, endpoint_url?: string, color: string }>,
 *   activeIds: string[],
 *   prompts: Record<string, string>,
 *   onToggleModel: (id: string) => void,
 *   onRemoveModel: (id: string) => void,
 *   onPromptChange: (id: string, value: string) => void,
 *   onAddClick: () => void
 * }} props
 */
export default function ModelSelector({
  models,
  activeIds,
  prompts,
  onRemoveModel,
  onPromptChange,
  onAddClick,
}) {
  const activeModels = models.filter((m) => activeIds.includes(m.id));
  const canRemove = activeIds.length > MIN_SLOTS;
  const canAdd = activeIds.length < MAX_SLOTS;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] text-gray-500 uppercase tracking-wider">
          Player Select ({activeIds.length}/{MAX_SLOTS})
        </h2>
      </div>

      <div className="flex flex-wrap gap-3">
        {activeModels.map((m) => (
          <ModelSlotCard
            key={m.id}
            model={m}
            systemPrompt={prompts[m.id] || ""}
            onRemove={() => onRemoveModel(m.id)}
            onPromptChange={(v) => onPromptChange(m.id, v)}
            canRemove={canRemove}
          />
        ))}

        {canAdd && (
          <button
            onClick={onAddClick}
            className="flex items-center justify-center min-w-[220px] h-[100px] border-2 border-dashed border-[#333366] text-gray-600 hover:border-[#3cf] hover:text-[#3cf] text-[10px] uppercase tracking-wider transition-colors"
          >
            + Add Model
          </button>
        )}
      </div>
    </div>
  );
}
