import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	LinhaExercicio,
	type ExercicioForm,
	type SugestoesTreino,
} from "~/components/treinos/linha-exercicio";

export function exercicioVazio(
	defaultVideo: string,
	repeticoes = "",
): ExercicioForm {
	return { exercicio: "", repeticoes, observacao: "", video: defaultVideo };
}

/**
 * Lista editável de exercícios. Enter nas repetições cria a próxima linha
 * (já com a mesma série da anterior, que costuma se repetir no grupo).
 */
export function ListaExercicios({
	exercicios,
	onChange,
	sugestoes,
	disabled,
}: {
	exercicios: ExercicioForm[];
	onChange: (exs: ExercicioForm[]) => void;
	sugestoes: SugestoesTreino;
	disabled: boolean;
}) {
	// só a linha recém-criada recebe foco; ao carregar a lista, nenhuma
	const [foco, setFoco] = useState<number | null>(null);

	function adicionar() {
		const anterior = exercicios[exercicios.length - 1];
		onChange([
			...exercicios,
			exercicioVazio(sugestoes.defaultVideo, anterior?.repeticoes ?? ""),
		]);
		setFoco(exercicios.length);
	}

	function atualizar(i: number, ex: ExercicioForm) {
		onChange(exercicios.map((e, j) => (j === i ? ex : e)));
	}

	function remover(i: number) {
		if (exercicios.length <= 1) {
			onChange([exercicioVazio(sugestoes.defaultVideo)]);
			return;
		}
		onChange(exercicios.filter((_, j) => j !== i));
	}

	return (
		<div className='space-y-2'>
			{exercicios.map((ex, i) => (
				<LinhaExercicio
					key={i}
					numero={i + 1}
					exercicio={ex}
					sugestoes={sugestoes}
					onChange={(e) => atualizar(i, e)}
					onRemove={() => remover(i)}
					onEnter={i === exercicios.length - 1 ? adicionar : undefined}
					autoFocus={foco === i}
					disabled={disabled}
				/>
			))}
			<Button
				type='button'
				variant='ghost'
				onClick={adicionar}
				disabled={disabled}
				className='w-full border border-dashed text-muted-foreground hover:text-foreground'>
				<Plus className='mr-1 size-4' />
				Adicionar exercício
				<span className='ml-2 hidden text-xs font-normal text-muted-foreground sm:inline'>
					(ou Enter nas repetições)
				</span>
			</Button>
		</div>
	);
}
