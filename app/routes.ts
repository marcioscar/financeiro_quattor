import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
	layout("routes/_layout.tsx", [index("routes/home.tsx"),
        route("despesas", "routes/despesas.tsx"),
        route("receitas", "routes/receitas.tsx"),
        route("folha", "routes/folha.tsx"),
        route("treinos", "routes/treinos.tsx"),
        route("treinos/pdf", "routes/treinos.pdf.tsx"),
        route("ponto/pdf", "routes/ponto.pdf.tsx"),
        route("ponto/espelho-pdf", "routes/ponto.espelho-pdf.tsx"),
        route("ponto/espelho-todos-pdf", "routes/ponto.espelho-todos-pdf.tsx"),
        route("cancelamentos", "routes/cancelamentos.tsx"),
        route("planos", "routes/planos.tsx"),
        route("planos/pdf", "routes/planos.pdf.tsx"),
        route("contas", "routes/contas.tsx"),
        route("ponto", "routes/ponto.tsx"),
        route("*", "routes/not-found.tsx"),
    ]),
] satisfies RouteConfig;