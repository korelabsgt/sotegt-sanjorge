"use client";

import { useState, Fragment, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { obtenerConfiguracionAction } from "../dashboard/actions/configuracion";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Eye,
  ChevronDown,
  Lock,
  User,
  Heart,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { eliminar } from "./acciones";
import {
  obtenerConteoPadronAction,
  obtenerTotalAfiliadosAction,
} from "./actions/afiliados";
import Swal from "sweetalert2";

export interface Lider {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  rol: string;
  rol_id?: number;
  conteoAfiliados?: number;
  conteoTitulares?: number;
  conteoFamiliares?: number;
}

interface Props {
  lideres: Lider[];
  onVerCelula: (lider: Lider) => void;
  onEditar: (lider: Lider) => void;
  rolUsuarioSesion: string;
  onDataChange: () => void;
  searchTerm: string;
  idUsuarioSesion: string;
  isLoading?: boolean;
  hideMeta?: boolean;
  showRole?: boolean;
}

function LideresSkeleton({ esAdminOSuper }: { esAdminOSuper: boolean }) {
  return (
    <div className="animate-pulse space-y-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-20 bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4"
        >
          <div className="h-10 w-10 bg-gray-100 rounded-lg"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 bg-gray-100 rounded"></div>
            <div className="h-3 w-1/4 bg-gray-50 rounded"></div>
          </div>
          <div className="h-10 w-24 bg-gray-100 rounded-lg"></div>
        </div>
      ))}
    </div>
  );
}

export default function Lideres({
  lideres,
  onVerCelula,
  onEditar,
  rolUsuarioSesion,
  onDataChange,
  searchTerm,
  idUsuarioSesion,
  isLoading = false,
  hideMeta = false,
  showRole = false,
}: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | "all">(10);
  const [liderAbiertoId, setLiderAbiertoId] = useState<string | null>(null);

  const isLider = rolUsuarioSesion === "LIDER";
  const esAdminOSuper =
    rolUsuarioSesion === "ADMINISTRADOR" || rolUsuarioSesion === "SUPER" || rolUsuarioSesion === "ADMIN";
  
  const { data: config } = useQuery({
    queryKey: ["config_sistema"],
    queryFn: () => obtenerConfiguracionAction(),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  });

  const { data: conteoPadron = 0 } = useQuery({
    queryKey: ["conteo_padron"],
    queryFn: () => obtenerConteoPadronAction(),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  });

  const { data: totalAfiliadosGeneral = 0 } = useQuery({
    queryKey: ["total_afiliados"],
    queryFn: () => obtenerTotalAfiliadosAction(),
    staleTime: 60 * 1000,
    refetchOnMount: false,
  });

  const OBJETIVO_GENERAL = config?.objetivo_total || 0;
  const META_POR_LIDER = config?.meta_por_lider || 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const progresoGeneral = useMemo(() =>
    OBJETIVO_GENERAL > 0 ? Math.min((totalAfiliadosGeneral / OBJETIVO_GENERAL) * 100, 100) : 0
  , [totalAfiliadosGeneral, OBJETIVO_GENERAL]);

  const sortedLideres = useMemo(() =>
    [...lideres].sort((a, b) => {
      if (a.id === idUsuarioSesion) return -1;
      if (b.id === idUsuarioSesion) return 1;
      return (b.conteoAfiliados || 0) - (a.conteoAfiliados || 0);
    })
  , [lideres, idUsuarioSesion]);

  const filteredLideres = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return sortedLideres.filter((lider) => {
      const fullName = `${lider.nombres} ${lider.apellidos}`.toLowerCase();
      const email = lider.email.toLowerCase();
      return fullName.includes(term) || email.includes(term);
    });
  }, [sortedLideres, searchTerm]);

  const effectiveItemsPerPage = useMemo(() =>
    itemsPerPage === "all" ? filteredLideres.length : itemsPerPage
  , [itemsPerPage, filteredLideres.length]);

  const totalPages = useMemo(() =>
    Math.ceil(filteredLideres.length / (effectiveItemsPerPage || 1))
  , [filteredLideres.length, effectiveItemsPerPage]);

  const startIndex = (currentPage - 1) * (effectiveItemsPerPage as number);

  const lideresPaginados = useMemo(() =>
    itemsPerPage === "all"
      ? filteredLideres
      : filteredLideres.slice(
          startIndex,
          startIndex + (effectiveItemsPerPage as number),
        )
  , [filteredLideres, startIndex, effectiveItemsPerPage, itemsPerPage]);

  if (isLoading) return <LideresSkeleton esAdminOSuper={esAdminOSuper} />;

  const getRowClass = (lider: Lider) => {
    if (lider.id === idUsuarioSesion) {
      return "bg-blue-50/50 border-blue-200 ring-1 ring-blue-500 shadow-md transform scale-[1.01]";
    }
    return "bg-white border-gray-200 hover:border-blue-300 hover:shadow-lg";
  };

  return (
    <>
      {!hideMeta && (
        <div className="w-full mb-6">
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs md:text-xl font-bold uppercase text-gray-600 font-sans">
              Meta General de Afiliación:
            </span>
            <span className="text-sm md:text-xl font-black text-blue-700">
              {totalAfiliadosGeneral.toLocaleString()} /{" "}
              {OBJETIVO_GENERAL.toLocaleString()} <span className="text-gray-500 font-bold ml-1">({progresoGeneral.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-6 border-2 border-white shadow-inner overflow-hidden flex items-center relative font-sans">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progresoGeneral}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="bg-blue-600 h-full shadow-[inset_0px_0px_10px_rgba(0,0,0,0.2)]"
            />
          </div>
          {conteoPadron > 0 && esAdminOSuper && (
            <div className="mt-2 text-right">
              <p className="text-xs md:text-xl font-bold text-gray-500 uppercase">
                Empadronados TSE registrados: <span className="text-blue-600">{conteoPadron.toLocaleString()}</span>
                {" "}• La meta <span className="text-blue-600 font-bold">{OBJETIVO_GENERAL.toLocaleString()}</span> representa el <span className="text-blue-600 font-bold">{(OBJETIVO_GENERAL > 0 ? (OBJETIVO_GENERAL / conteoPadron) * 100 : 0).toFixed(1)}%</span> del padrón local
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-start mb-2 px-2">
        <span className="text-sm md:text-xl font-black text-blue-800 uppercase tracking-tight">
          Líderes registrados: <span className="text-blue-600">{lideres.length}</span>
        </span>
      </div>

      {/* Lista de Tarjetas en una sola columna */}
      <div className="flex flex-col gap-3">
        {lideresPaginados.map((lider, index) => {
          const totalEnGrupo = lider.conteoAfiliados || 0;
          const progreso = META_POR_LIDER > 0 ? Math.min((totalEnGrupo / META_POR_LIDER) * 100, 100) : 0;
          const tieneAfiliados = totalEnGrupo > 0;

          return (
            <div
              key={lider.id}
              className={`flex flex-col md:flex-row items-stretch md:items-center border rounded-lg overflow-hidden shadow-sm transition-all duration-300 ${getRowClass(lider)}`}
            >
              {/* Contenedor Principal */}
              <div 
                className={`flex-1 p-4 flex flex-col md:flex-row md:items-center gap-4 ${isLider && lider.id !== idUsuarioSesion ? "cursor-default" : "cursor-pointer"}`}
                onClick={() => {
                  if (rolUsuarioSesion === "LIDER" && lider.id !== idUsuarioSesion) return;
                  if (window.innerWidth < 768 && rolUsuarioSesion !== "LIDER") {
                    setLiderAbiertoId(liderAbiertoId === lider.id ? null : lider.id);
                  } else {
                    onVerCelula(lider);
                  }
                }}
              >
                {/* No. y Nombre */}
                <div className="flex items-center gap-3 min-w-0 md:w-1/3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-xs font-black text-blue-600 border border-blue-100 shrink-0">
                    {startIndex + index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-black text-sm md:text-base leading-tight line-clamp-2 break-words ${lider.id === idUsuarioSesion ? "text-blue-900" : "text-gray-900"}`}>
                      {lider.nombres} {lider.apellidos}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] md:text-xs text-gray-500 italic lowercase truncate">
                        {lider.email}
                      </p>
                      {showRole && (
                        <span className="text-[8px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0">
                          {lider.rol}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Meta / Progreso */}
                <div className="flex-1 md:max-w-none w-full">
                   <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-black text-gray-400 uppercase">Progreso de Célula</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 shadow-sm" title="Titulares">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          <span className="hidden md:inline text-[10px] font-black text-blue-600 uppercase">Titulares</span>
                          <span className="text-sm font-black text-blue-700">{lider.conteoTitulares || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-purple-50 px-2 py-1 rounded-md border border-purple-100 shadow-sm" title="Familiares">
                          <Heart className="w-3.5 h-3.5 text-purple-600" />
                          <span className="hidden md:inline text-[10px] font-black text-purple-600 uppercase">Familiares</span>
                          <span className="text-sm font-black text-purple-700">{lider.conteoFamiliares || 0}</span>
                        </div>
                        <span className="text-xs md:text-sm font-black text-gray-500 ml-1 whitespace-nowrap">
                          Total <span className="text-blue-700 font-black">{totalEnGrupo}</span> de <span className="text-gray-400 font-bold">{META_POR_LIDER}</span>
                        </span>
                      </div>
                   </div>
                   <div className="w-full bg-gray-100 rounded-full h-4 border overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progreso}%` }}
                        className="bg-blue-600 h-full rounded-full shadow-sm"
                      />
                   </div>
                </div>

                {/* Flecha solo en Móvil */}
                <div className="md:hidden flex justify-center pt-2">
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${liderAbiertoId === lider.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Botones de Acción - Siempre a la Derecha en Desktop */}
              {rolUsuarioSesion !== "LIDER" && (
                <div className="hidden md:flex items-center gap-2 px-4 py-2 border-l border-gray-100 bg-gray-50/30">


                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-3 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors"
                    onClick={(e) => { e.stopPropagation(); onEditar(lider); }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    <span className="text-[10px] font-bold uppercase">Editar Líder</span>
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-3 rounded-lg transition-colors text-red-500 hover:bg-red-600 hover:text-white"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (tieneAfiliados) {
                        Swal.fire({
                          icon: "error",
                          title: "No se puede eliminar",
                          text: "No se puede eliminar porque hay afiliados en el sistema asignados a esta célula.",
                          confirmButtonColor: "#2563eb"
                        });
                      } else {
                        eliminar(lider, onDataChange);
                      }
                    }}
                    title="Eliminar líder"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span className="text-[10px] font-bold uppercase">Eliminar</span>
                  </Button>
                </div>
              )}

              {/* Acordeón Móvil */}
              <AnimatePresence>
                {liderAbiertoId === lider.id && rolUsuarioSesion !== "LIDER" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="md:hidden border-t border-gray-100 bg-gray-50 flex divide-x"
                  >
                    <Button
                      variant="ghost"
                      className="flex-1 text-gray-700 py-4 font-bold uppercase text-[10px] rounded-none"
                      onClick={(e) => { e.stopPropagation(); onVerCelula(lider); }}
                    >
                      <Eye className="h-4 w-4 mr-2" /> Ver
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 text-blue-600 py-4 font-bold uppercase text-[10px] rounded-none"
                      onClick={(e) => { e.stopPropagation(); onEditar(lider); }}
                    >
                      <Pencil className="h-4 w-4 mr-2" /> Editar Líder
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 py-4 font-bold uppercase text-[10px] rounded-none text-red-500"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (tieneAfiliados) {
                          Swal.fire({
                            icon: "error",
                            title: "No se puede eliminar",
                            text: "No se puede eliminar porque hay afiliados en el sistema asignados a esta célula.",
                            confirmButtonColor: "#2563eb"
                          });
                        } else {
                          eliminar(lider, onDataChange);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Borrar
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Paginación */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-8">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="w-10 h-10 rounded-lg border-gray-200 hover:bg-blue-50 text-blue-600 transition-all shadow-sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1 || itemsPerPage === "all"}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm min-w-[120px] text-center">
            <span className="text-sm font-black text-gray-900">{currentPage} / {totalPages || 1}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-10 h-10 rounded-lg border-gray-200 hover:bg-blue-50 text-blue-600 transition-all shadow-sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || itemsPerPage === "all"}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm">
          <select
            value={itemsPerPage}
            onChange={(e) => {
              const val = e.target.value;
              setItemsPerPage(val === "all" ? "all" : parseInt(val));
            }}
            className="text-sm font-black outline-none bg-transparent cursor-pointer uppercase text-blue-600 focus:ring-0"
          >
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value="all">Todos</option>
          </select>
        </div>
      </div>
    </>
  );
}
