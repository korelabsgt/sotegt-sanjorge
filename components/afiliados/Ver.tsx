"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import {
  Search,
  X,
  BarChart3,
  Settings,
  UserPlus,
  Users,
  ClipboardList,
  Shield,
  Crown,
  FileBarChart,
} from "lucide-react";

import EstadisticasTabs from "./estadisticas/EstadisticasTabs";
import ConfiguracionSistema from "../dashboard/ConfiguracionSistema";

import Lideres from "./Lideres";
import AfiliadosGeneral from "./AfiliadosGeneral";
import Form from "./forms/afiliados/Afiliados";
import Celula from "./Celula";
import Padron from "./Padron";
import { SignupForm } from "@/components/admin/sign-up/SignForm";
import type { Afiliado, Lider } from "./esquemas";
import {
  Dialog,
  Transition,
  TransitionChild,
  DialogPanel,
} from "@headlessui/react";

import { obtenerAfiliadosAction } from "./actions/afiliados";
import { obtenerConfiguracionAction } from "@/components/dashboard/actions/configuracion";
import { loadAfiliacionVerDashboardAction } from "./actions/afiliacion-ver-dashboard";
import ReporteLideresClasificacion from "./reportes/ReporteLideresClasificacion";

type Lugar = {
  id: number;
  nombre: string;
  sector_id: number | null;
  sector_nombre: string | null;
};
type Tab = "Lideres" | "Afiliados" | "Padron" | "Administrativos";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export const AFILIACION_VER_QK = ["afiliacion-ver-dashboard"] as const;

export default function Ver() {
  const queryClient = useQueryClient();

  const {
    data: dashboard,
    isPending: dashboardPending,
    isError: dashboardIsError,
    error: dashboardError,
  } = useQuery({
    queryKey: AFILIACION_VER_QK,
    queryFn: async () => {
      const res = await loadAfiliacionVerDashboardAction();
      if (res === null) {
        throw new Error("No autorizado");
      }
      return res;
    },
    staleTime: 60_000,
    gcTime: 15 * 60_000,
  });

  const rol = dashboard?.session.rol ?? null;
  const userId = dashboard?.session.id ?? "";
  const esAdminOSuper =
    rol === "ADMINISTRADOR" || rol === "SUPER" || rol === "ADMIN";
  const puedeVerReportesLideres =
    rol === "ADMIN" || rol === "SUPER";

  const { lideres, administrativos, lugares } = useMemo(() => {
    if (!dashboard) {
      return {
        lideres: [] as Lider[],
        administrativos: [] as Lider[],
        lugares: [] as Lugar[],
      };
    }

    const { session, todosUsuariosData, lugaresData } = dashboard;
    const rolVal = session.rol;
    if (!rolVal) {
      return {
        lideres: [] as Lider[],
        administrativos: [] as Lider[],
        lugares: [] as Lugar[],
      };
    }

    const arrAdmins = ["ADMINISTRADOR", "SUPER", "ADMIN"];
    const allUsers = (
      Array.isArray(todosUsuariosData)
        ? todosUsuariosData
        : (todosUsuariosData as { data?: Lider[] })?.data || []
    ) as Lider[];

    const allLideres = allUsers.filter((u) => u.rol === "LIDER");
    const rolesVisibles =
      rolVal === "SUPER" ? arrAdmins : ["ADMIN", "ADMINISTRADOR"];
    const allAdmins = allUsers.filter((u) => rolesVisibles.includes(u.rol));

    let lideresOrdered: Lider[];
    if (rolVal === "LIDER" && session.id) {
      const myLider = allLideres.find((l) => l.id === session.id);
      const otherLideres = allLideres.filter((l) => l.id !== session.id);
      lideresOrdered = myLider ? [myLider, ...otherLideres] : allLideres;
    } else {
      lideresOrdered = allLideres;
    }

    const lugaresNorm = (
      Array.isArray(lugaresData)
        ? lugaresData
        : (lugaresData as { data?: Lugar[] })?.data || []
    ) as Lugar[];

    return {
      lideres: lideresOrdered,
      administrativos: allAdmins,
      lugares: lugaresNorm,
    };
  }, [dashboard]);

  const [activeTab, setActiveTab] = useState<Tab>("Lideres");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCelulaOpen, setIsCelulaOpen] = useState(false);
  const [isEstadisticasOpen, setIsEstadisticasOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [isReportesLideresOpen, setIsReportesLideresOpen] = useState(false);

  const [afiliadoParaEditar, setAfiliadoParaEditar] = useState<Afiliado | null>(
    null,
  );
  const [liderAEditar, setLiderAEditar] = useState<Lider | null>(null);
  const [liderParaCelula, setLiderParaCelula] = useState<Lider | null>(null);
  const [liderParaNuevoAfiliado, setLiderParaNuevoAfiliado] = useState<
    string | null
  >(null);
  const [familiarDeIdParaNuevo, setFamiliarDeIdParaNuevo] = useState<
    string | null
  >(null);

  const [isFirstMemberAddition, setIsFirstMemberAddition] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: afiliados = [], isPending: isLoadingAfiliados } = useQuery({
    queryKey: ["afiliados-gl"],
    queryFn: () => obtenerAfiliadosAction(),
    enabled:
      isEstadisticasOpen ||
      activeTab === "Afiliados" ||
      (isReportesLideresOpen && puedeVerReportesLideres),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
  });

  const { data: configSis } = useQuery({
    queryKey: ["config_sistema"],
    queryFn: () => obtenerConfiguracionAction(),
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });

  const padronHabilitado = configSis?.padron === true;

  const invalidateAfiliadosRelatedQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["afiliados-lider"] });
    queryClient.invalidateQueries({ queryKey: ["afiliados-gl"] });
    queryClient.invalidateQueries({ queryKey: ["conteo_padron"] });
    queryClient.invalidateQueries({ queryKey: ["total_afiliados"] });
  };

  const fetchData = async () => {
    await queryClient.refetchQueries({ queryKey: AFILIACION_VER_QK });
  };

  const refreshAfterDeletion = () => {
    invalidateAfiliadosRelatedQueries();
    void fetchData();
  };

  useEffect(() => {
    if (dashboardIsError) {
      toast.error("No autorizado o error al cargar.");
      console.error(dashboardError);
    }
  }, [dashboardIsError, dashboardError]);

  const handleOpenCreateLiderModal = () => {
    setLiderAEditar(null);
    setIsSignupModalOpen(true);
  };

  const handleOpenEditLiderModal = (lider: Lider) => {
    setLiderAEditar(lider);
    setIsSignupModalOpen(true);
  };

  const handleSignupSuccess = () => {
    setIsSignupModalOpen(false);
    setLiderAEditar(null);
    queryClient.invalidateQueries({ queryKey: ["lideres"] });
    queryClient.invalidateQueries({ queryKey: ["administrativos"] });
    void fetchData();
  };

  const handleCloseSignupModal = () => {
    setIsSignupModalOpen(false);
    setLiderAEditar(null);
  };

  const handleOpenAnadirAfiliadoModal = (
    liderId: string,
    isFirstMember = false,
    familiarDeId: string | null = null,
  ) => {
    setIsCelulaOpen(false);
    setAfiliadoParaEditar(null);
    setLiderParaNuevoAfiliado(liderId);
    setIsFirstMemberAddition(isFirstMember);
    setFamiliarDeIdParaNuevo(familiarDeId);
    setIsFormOpen(true);
  };

  const handleOpenEditModal = (afiliado: Afiliado) => {
    setIsCelulaOpen(false);
    setAfiliadoParaEditar(afiliado);
    setLiderParaNuevoAfiliado(null);
    setFamiliarDeIdParaNuevo(null);
    setIsFirstMemberAddition(false);
    setIsFormOpen(true);
  };

  const handleOpenCelulaModal = (lider: Lider) => {
    if (!lider) return;
    setLiderParaCelula(lider);
    setIsCelulaOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormOpen(false);
    if (liderParaCelula) setIsCelulaOpen(true);
  };

  const handleCloseCelulaModal = () => {
    setIsCelulaOpen(false);
    setLiderParaCelula(null);
  };

  const handleSaveAndCloseForm = async () => {
    setIsFormOpen(false);
    invalidateAfiliadosRelatedQueries();

    await fetchData();

    if (liderParaCelula) {
      const updatedLider = lideres.find((l) => l.id === liderParaCelula.id);
      if (updatedLider) {
        setLiderParaCelula(updatedLider);
        setIsCelulaOpen(true);
      }
    }
  };

  return (
    <>
      <div className="px-2 md:px-6">
        <ConfiguracionSistema showMetas={false} allowEditing={false} />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <h1 className="text-2xl font-bold text-black md:text-3xl whitespace-nowrap flex items-center gap-2">
              Gestión de Datos{" "}
              <BarChart3 className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            </h1>
          </div>
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre"
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-end gap-2 w-full md:w-auto">
            <Button
              onClick={() => setIsEstadisticasOpen(true)}
              variant="outline"
              className="gap-2 w-full text-xs md:text-xl font-bold"
            >
              <BarChart3 className="w-4 h-4 md:w-6 md:h-6" /> Estadísticas
              Generales
            </Button>
            {esAdminOSuper && (
              <Button
                onClick={() => setIsConfigOpen(true)}
                variant="outline"
                className="gap-2 w-full text-xs md:text-xl font-bold"
              >
                <Settings className="w-4 h-4 md:w-6 md:h-6" /> Configuraciones
              </Button>
            )}
            {esAdminOSuper && (
              <Button
                onClick={handleOpenCreateLiderModal}
                className="gap-2 w-full text-xl font-bold"
              >
                <UserPlus className="w-6 h-6" /> Nuevo Líder
              </Button>
            )}
          </div>
        </div>

        <div className="flex border-b mb-6 overflow-x-auto no-scrollbar whitespace-nowrap">
          <button
            onClick={() => setActiveTab("Lideres")}
            className={`px-4 py-3 text-sm md:text-base font-black uppercase flex items-center gap-2 transition-all ${
              activeTab === "Lideres"
                ? "border-b-4 border-orange-500 text-orange-600 bg-orange-50/50"
                : "text-gray-400 hover:text-gray-600 border-b-4 border-transparent"
            }`}
          >
            <Crown
              className={`w-4 h-4 md:w-5 md:h-5 ${activeTab === "Lideres" ? "text-orange-500" : ""}`}
            />
            Líderes
          </button>

          <button
            onClick={() => setActiveTab("Afiliados")}
            className={`px-4 py-3 text-sm md:text-base font-black uppercase flex items-center gap-2 transition-all ${
              activeTab === "Afiliados"
                ? "border-b-4 border-purple-600 text-purple-700 bg-purple-50/50"
                : "text-gray-400 hover:text-gray-600 border-b-4 border-transparent"
            }`}
          >
            <Users
              className={`w-4 h-4 md:w-5 md:h-5 ${activeTab === "Afiliados" ? "text-purple-600" : ""}`}
            />
            Miembros
          </button>

          {(rol === "ADMINISTRADOR" || rol === "SUPER" || rol === "ADMIN") && (
            <>
              {padronHabilitado && (
                <button
                  onClick={() => setActiveTab("Padron")}
                  className={`px-4 py-3 text-sm md:text-base font-black uppercase flex items-center gap-2 transition-all ${
                    activeTab === "Padron"
                      ? "border-b-4 border-green-600 text-green-700 bg-green-50/50"
                      : "text-gray-400 hover:text-gray-600 border-b-4 border-transparent"
                  }`}
                >
                  <ClipboardList
                    className={`w-4 h-4 md:w-5 md:h-5 ${activeTab === "Padron" ? "text-green-600" : ""}`}
                  />
                  Padrón
                </button>
              )}
              <button
                onClick={() => setActiveTab("Administrativos")}
                className={`px-4 py-3 text-sm md:text-base font-black uppercase flex items-center gap-2 transition-all ${
                  activeTab === "Administrativos"
                    ? "border-b-4 border-blue-600 text-blue-700 bg-blue-50/50"
                    : "text-gray-400 hover:text-gray-600 border-b-4 border-transparent"
                }`}
              >
                <Shield
                  className={`w-4 h-4 md:w-5 md:h-5 ${activeTab === "Administrativos" ? "text-blue-600" : ""}`}
                />
                Administrativos
              </button>
            </>
          )}
        </div>

        {activeTab === "Lideres" && (
          <Lideres
            lideres={lideres}
            onVerCelula={handleOpenCelulaModal}
            onEditar={handleOpenEditLiderModal}
            rolUsuarioSesion={rol ?? ""}
            onDataChange={refreshAfterDeletion}
            searchTerm={searchTerm}
            idUsuarioSesion={userId}
            isLoading={dashboardPending}
          />
        )}
        {activeTab === "Afiliados" && (
          <AfiliadosGeneral
            afiliados={afiliados}
            lideres={lideres}
            onEditar={handleOpenEditModal}
            onDataChange={refreshAfterDeletion}
            searchTerm={searchTerm}
            isLoading={isLoadingAfiliados}
            idUsuarioSesion={userId}
            rolUsuarioSesion={rol ?? ""}
          />
        )}
        {activeTab === "Padron" && <Padron />}
        {activeTab === "Administrativos" && (
          <>
            {puedeVerReportesLideres && (
              <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 font-bold text-blue-900 border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-sm md:text-base"
                  onClick={() => setIsReportesLideresOpen(true)}
                >
                  <FileBarChart className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                  Reportes
                </Button>
              </div>
            )}
            <Lideres
              lideres={administrativos}
              onVerCelula={handleOpenCelulaModal}
              onEditar={handleOpenEditLiderModal}
              rolUsuarioSesion={rol ?? ""}
              onDataChange={refreshAfterDeletion}
              searchTerm={searchTerm}
              idUsuarioSesion={userId}
              isLoading={dashboardPending}
              hideMeta
              showRole={true}
            />
          </>
        )}
      </div>

      <Transition show={isEstadisticasOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsEstadisticasOpen(false)}
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-0 md:p-4">
            <DialogPanel className="w-screen h-screen bg-white flex flex-col">
              <div className="flex justify-between items-center px-6 py-3 border-b shrink-0 bg-white z-10">
                <div className="flex flex-col">
                  <h3 className="text-base md:text-xl font-bold uppercase flex items-center gap-2">
                    Estadísticas Generales{" "}
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </h3>
                  <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">
                    Análisis global de {afiliados.length} registros
                  </p>
                </div>

                <Button
                  onClick={() => setIsEstadisticasOpen(false)}
                  variant="ghost"
                  size="icon"
                  className="rounded-full shrink-0 h-8 w-8"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto bg-gray-50/30 py-4 md:p-6">
                <div className="max-w-[1600px] mx-auto">
                  <EstadisticasTabs afiliados={afiliados} />
                </div>
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      </Transition>

      <Dialog
        open={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        className="relative z-50 font-sans"
      >
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          aria-hidden="true"
        />
        <div className="fixed inset-0 flex items-center justify-center p-0 sm:p-4">
          <DialogPanel className="mx-auto w-full md:w-[70vw] max-w-none bg-white rounded-none sm:rounded-3xl shadow-2xl overflow-hidden h-full sm:h-[95vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h2 className="text-2xl font-black text-blue-900 flex items-center gap-2">
                <Settings className="h-6 w-6" /> Configuración del Sistema
              </h2>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>
            <div className="p-4 md:p-6 flex-1 overflow-y-auto bg-gray-50/30 flex flex-col">
              <ConfiguracionSistema onClose={() => setIsConfigOpen(false)} />
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      <Celula
        isOpen={isCelulaOpen}
        onClose={handleCloseCelulaModal}
        lider={liderParaCelula}
        onEditar={handleOpenEditModal}
        onAnadirAfiliado={handleOpenAnadirAfiliadoModal}
        onDataChange={refreshAfterDeletion}
        rolUsuarioSesion={rol ?? ""}
      />

      <Form
        isOpen={isFormOpen}
        onClose={handleCloseFormModal}
        onSave={handleSaveAndCloseForm}
        afiliadoAEditar={afiliadoParaEditar}
        liderPredefinidoId={liderParaNuevoAfiliado}
        lugares={lugares}
        lideres={lideres}
        afiliados={afiliados}
        isFirstMember={isFirstMemberAddition}
        familiarDeId={familiarDeIdParaNuevo}
        datosLider={lideres.find((l) => l.id === liderParaNuevoAfiliado)}
      />

      <ReporteLideresClasificacion
        open={isReportesLideresOpen && puedeVerReportesLideres}
        onClose={() => setIsReportesLideresOpen(false)}
        lideres={lideres}
        afiliados={afiliados}
        mostrarOpcionSimular={String(rol ?? "").toUpperCase() === "SUPER"}
      />

      <Transition show={isSignupModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={handleCloseSignupModal}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
          </TransitionChild>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <DialogPanel className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                  <div className="p-4 md:p-8">
                    <SignupForm
                      initialData={liderAEditar}
                      onSuccess={handleSignupSuccess}
                      onClose={handleCloseSignupModal}
                      isModal={true}
                    />
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
