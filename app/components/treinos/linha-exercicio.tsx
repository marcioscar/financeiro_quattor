import { Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "~/components/ui/combobox";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";

export type ExercicioForm = {
	exercicio: string;
	repeticoes: string;
	observacao: string;
	video: string;
};

export function LinhaExercicio({
	exercicio,
	videoItems,
	onChange,
	onRemove,
	disabled,
}: {
	exercicio: ExercicioForm;
	videoItems: Array<{ value: string; label: string }>;
	onChange: (ex: ExercicioForm) => void;
	onRemove: () => void;
	disabled: boolean;
}) {
	const anchorVideoRef = useComboboxAnchor();
	const videoLabel =
		videoItems.find((item) => item.value === exercicio.video)?.label ?? "";
	const videoValue = exercicio.video;

	return (
		<div className="flex flex-col gap-3 rounded-lg border p-4">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium text-muted-foreground">
					Exercício
				</span>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={onRemove}
					disabled={disabled}
					className="h-8 w-8 text-destructive hover:bg-destructive/10"
				>
					<Trash2 className="size-4" />
				</Button>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<Field>
					<FieldLabel>Exercício</FieldLabel>
					<Input
						placeholder="Ex: Abdominal Supra Solo"
						value={exercicio.exercicio}
						onChange={(e) => onChange({ ...exercicio, exercicio: e.target.value })}
						disabled={disabled}
					/>
				</Field>
				<Field>
					<FieldLabel>Repetições</FieldLabel>
					<Input
						placeholder="Ex: 3 x 20"
						value={exercicio.repeticoes}
						onChange={(e) =>
							onChange({ ...exercicio, repeticoes: e.target.value })
						}
						disabled={disabled}
					/>
				</Field>
			</div>
			<div ref={anchorVideoRef} className="space-y-2">
				<Field>
					<FieldLabel>Vídeo</FieldLabel>
					<Combobox
						value={
							videoValue ? { value: videoValue, label: videoLabel } : null
						}
						onValueChange={(v) =>
							v && onChange({ ...exercicio, video: v.value })
						}
						items={videoItems}
					>
						<ComboboxInput placeholder="Buscar vídeo..." showClear />
						<ComboboxContent anchor={anchorVideoRef}>
							<ComboboxList>
								{(item) => (
									<ComboboxItem key={item.value} value={item}>
										{item.label}
									</ComboboxItem>
								)}
							</ComboboxList>
							<ComboboxEmpty>Nenhum vídeo encontrado</ComboboxEmpty>
						</ComboboxContent>
					</Combobox>
				</Field>
			</div>
			<Field>
				<FieldLabel>Observação</FieldLabel>
				<Input
					placeholder="Opcional"
					value={exercicio.observacao}
					onChange={(e) => onChange({ ...exercicio, observacao: e.target.value })}
					disabled={disabled}
				/>
			</Field>
		</div>
	);
}
