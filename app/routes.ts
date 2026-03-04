import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
	layout("routes/_layout.tsx", [index("routes/home.tsx"),
        route("despesas", "routes/despesas.tsx"),
        route("receitas", "routes/receitas.tsx"),
        route("folha", "routes/folha.tsx"),
        route("treinos", "routes/treinos.tsx"),
        route("cancelamentos", "routes/cancelamentos.tsx"),
        route("contas", "routes/contas.tsx"),
       
    ]),
] satisfies RouteConfig;