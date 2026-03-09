import { useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { getAlunosAtivos } from "~/models/evo.server";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Users, AlertCircle } from "lucide-react";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Financeiro Quattor" },
		{ name: "description", content: "Financeiro Quattor" },
	];
}

export async function loader() {
	const { alunos, erro } = await getAlunosAtivos(new Date());
	return {
		totalAlunosAtivos: alunos.length,
		erro,
	};
}

export default function Home() {
	const { totalAlunosAtivos, erro } = useLoaderData<typeof loader>();

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Users className="h-5 w-5" />
						<CardTitle>Alunos ativos (hoje)</CardTitle>
					</div>
					<CardDescription>
						Membros com contrato vigente na data atual — dados da EVO
					</CardDescription>
				</CardHeader>
				<CardContent>
					{erro && (
						<div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<p className="text-sm">{erro}</p>
						</div>
					)}
					{!erro && (
						<div className="flex items-baseline gap-2">
							<span className="text-4xl font-bold tabular-nums">
								{totalAlunosAtivos}
							</span>
							<span className="text-muted-foreground">
								{totalAlunosAtivos === 1 ? "aluno ativo" : "alunos ativos"}
							</span>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
