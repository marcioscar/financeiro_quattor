import { Link, useLocation } from "react-router";
import { Home } from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar";
import {
	BanknoteArrowUp,
	BanknoteArrowDown,
	ShoppingCart,
	UserPen,
	HandCoins,
	CircleX,
	Dumbbell,
} from "lucide-react";

export function AppSidebar() {
	const location = useLocation();

	return (
		<Sidebar collapsible='icon'>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild size='lg'>
							<Link to='/' className='flex items-center gap-2'>
								{/* Logo - visível quando sidebar aberta */}
								<div className='flex min-w-0 flex-1 items-center overflow-hidden  group-data-[collapsible=icon]:hidden'>
									<img
										src='/logo_quattor.webp'
										alt='Quattor'
										className='h-8 w-auto object-left'
									/>
								</div>
								{/* Ícone - visível quando sidebar fechada */}
								<div className='hidden size-8 shrink-0 items-center justify-center overflow-hidden  group-data-[collapsible=icon]:flex'>
									<img
										src='/bolas.webp'
										alt='Quattor'
										className='size-8 object-contain'
									/>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navegação</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild isActive={location.pathname === "/"}>
									<Link to='/'>
										<Home />
										<span>Home</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									isActive={location.pathname === "/despesas"}>
									<Link to='/despesas'>
										<BanknoteArrowDown className='size-4 text-red-600' />
										<span>Despesas</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									isActive={location.pathname === "/contas"}>
									<Link to='/contas'>
										<HandCoins className='size-4 text-green-600' />
										<span>Contas a pagar</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									isActive={location.pathname === "/receitas"}>
									<Link to='/receitas'>
										<BanknoteArrowUp className='size-4 text-green-600' />
										<span>Receitas</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									isActive={location.pathname === "/folha"}>
									<Link to='/folha'>
										<UserPen className='size-4 text-blue-600' />
										<span>Folha</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									isActive={location.pathname === "/treinos"}>
									<Link to='/treinos'>
										<Dumbbell className='size-4 text-yellow-600' />
										<span>Treinos</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									isActive={location.pathname === "/cancelamentos"}>
									<Link to='/cancelamentos'>
										<CircleX className='size-4 text-orange-400-600' />
										<span>Cancelamentos</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
