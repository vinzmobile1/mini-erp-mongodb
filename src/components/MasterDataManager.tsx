import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Users,
  Tag,
  ShoppingBag,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  Boxes,
  X,
  Check,
  FileSpreadsheet,
  Download,
  ArrowUp,
  ArrowDown,
  Filter,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  GripVertical,
  MousePointerClick,
  Workflow,
  Palette,
} from "lucide-react";
import { SimpleTable, ReactColumnDef, ReactIconsConfig } from "@simple-table/react";
import { Channel, Customer, Divisi, SalesPerson, Brand, ItemGroup, Category, Product, OrderStatusMaster } from "../types";
import { api } from "../lib/api";
import { SearchableSelect } from "./SearchableSelect";
import { MasterExcelImportModal } from "./MasterExcelImportModal";
import { ConfirmModal } from "./ConfirmModal";
import { downloadSingleMasterTemplate } from "../lib/excelUtils";
import { PRESET_COLORS, getChannelColor, getStatusColor, getDynamicBadgeStyle } from "../lib/colorUtils";

// Custom Lucide Icons matching app convention
const simpleTableIcons: ReactIconsConfig = {
  sortUp: <ArrowUp className="w-3.5 h-3.5 text-zinc-700" />,
  sortDown: <ArrowDown className="w-3.5 h-3.5 text-zinc-700" />,
  filter: <Filter className="w-3.5 h-3.5 text-zinc-500" />,
  expand: <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />,
  headerCollapse: <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />,
  headerExpand: <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />,
  next: <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />,
  prev: <ChevronLeft className="w-3.5 h-3.5 text-zinc-600" />,
  drag: <GripVertical className="w-3.5 h-3.5 text-zinc-400" />,
};

interface MasterDataManagerProps {
  channels?: Channel[];
  orderStatuses?: OrderStatusMaster[];
  customers?: Customer[];
  divisi: Divisi[];
  salesPersons: SalesPerson[];
  brands: Brand[];
  itemGroups: ItemGroup[];
  categories: Category[];
  products: Product[];
  onRefresh: () => void;
}

type MasterTab = "divisi" | "sales" | "brand" | "group" | "category" | "product" | "channel" | "status" | "customers";

export const MasterDataManager: React.FC<MasterDataManagerProps> = ({
  channels = [],
  orderStatuses = [],
  customers = [],
  divisi,
  salesPersons,
  brands,
  itemGroups,
  categories,
  products,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<MasterTab>("divisi");
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forms states (Create)
  const [namaDivisi, setNamaDivisi] = useState("");
  const [namaSales, setNamaSales] = useState("");
  const [selectedDivisiId, setSelectedDivisiId] = useState<number | null>(null);
  const [namaBrand, setNamaBrand] = useState("");
  const [namaGroup, setNamaGroup] = useState("");
  const [namaKategori, setNamaKategori] = useState("");
  const [namaChannel, setNamaChannel] = useState("");
  const [channelColor, setChannelColor] = useState("#10B981");

  // Status Nota States (Create)
  const [namaStatus, setNamaStatus] = useState("");
  const [colorStatus, setColorStatus] = useState("#3B82F6");
  const [urutanStatus, setUrutanStatus] = useState<number>(1);
  const [nextStatus, setNextStatus] = useState("");
  const [isFinalStatus, setIsFinalStatus] = useState(false);

  const [namaCustomer, setNamaCustomer] = useState("");
  const [teleponCustomer, setTeleponCustomer] = useState("");
  const [alamatCustomer, setAlamatCustomer] = useState("");

  const [sku, setSku] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemGroup, setItemGroup] = useState("");
  const [category, setCategory] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);

  // Edit States for all entities (Cell Click triggers modal)
  const [editingDivisi, setEditingDivisi] = useState<Divisi | null>(null);
  const [editDivisiName, setEditDivisiName] = useState("");

  const [editingSales, setEditingSales] = useState<SalesPerson | null>(null);
  const [editSalesName, setEditSalesName] = useState("");
  const [editSalesDivisiId, setEditSalesDivisiId] = useState<number | null>(null);

  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editBrandName, setEditBrandName] = useState("");

  const [editingGroup, setEditingGroup] = useState<ItemGroup | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editBrandId, setEditBrandId] = useState<number | null>(null);
  const [editItemGroup, setEditItemGroup] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editChannelName, setEditChannelName] = useState("");
  const [editChannelColor, setEditChannelColor] = useState("#10B981");

  const [editingStatus, setEditingStatus] = useState<OrderStatusMaster | null>(null);
  const [editStatusName, setEditStatusName] = useState("");
  const [editStatusColor, setEditStatusColor] = useState("#3B82F6");
  const [editStatusUrutan, setEditStatusUrutan] = useState<number>(1);
  const [editStatusNext, setEditStatusNext] = useState("");
  const [editStatusIsFinal, setEditStatusIsFinal] = useState(false);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Custom Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: async () => {},
    isLoading: false,
  });

  // Automatically sync default group and category when lists load/update
  useEffect(() => {
    if (itemGroups.length > 0 && (!itemGroup || !itemGroups.some((g) => g.nama_group === itemGroup))) {
      setItemGroup(itemGroups[0].nama_group);
    }
  }, [itemGroups]);

  useEffect(() => {
    if (categories.length > 0 && (!category || !categories.some((c) => c.nama_kategori === category))) {
      setCategory(categories[0].nama_kategori);
    }
  }, [categories]);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
    }
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 4000);
  };

  // --- Handlers for Create ---
  const handleAddDivisi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaDivisi.trim()) return;
    setIsSubmitting(true);
    try {
      await api.createDivisi(namaDivisi.trim());
      setNamaDivisi("");
      showNotification(`Divisi '${namaDivisi}' berhasil ditambahkan.`);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaSales.trim() || !selectedDivisiId) {
      showNotification("Nama sales dan divisi wajib diisi!", true);
      return;
    }
    setIsSubmitting(true);
    try {
      await api.createSalesPerson({ nama_sales: namaSales.trim(), divisi_id: selectedDivisiId });
      setNamaSales("");
      setSelectedDivisiId(null);
      showNotification(`Sales Person '${namaSales}' berhasil ditambahkan.`);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaBrand.trim()) return;
    setIsSubmitting(true);
    try {
      await api.createBrand(namaBrand.trim());
      setNamaBrand("");
      showNotification(`Brand '${namaBrand}' berhasil ditambahkan.`);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaGroup.trim()) return;
    setIsSubmitting(true);
    try {
      await api.createItemGroup(namaGroup.trim());
      setNamaGroup("");
      showNotification(`Group '${namaGroup}' berhasil ditambahkan.`);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaKategori.trim()) return;
    setIsSubmitting(true);
    try {
      await api.createCategory(namaKategori.trim());
      setNamaKategori("");
      showNotification(`Kategori '${namaKategori}' berhasil ditambahkan.`);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !itemName.trim() || !selectedBrandId) {
      showNotification("SKU, Nama Produk, dan Brand wajib diisi!", true);
      return;
    }
    setIsSubmitting(true);
    try {
      await api.createProduct({
        sku: sku.trim().toUpperCase(),
        item_name: itemName.trim(),
        item_group: itemGroup || null,
        category: category || null,
        brand_id: selectedBrandId,
      });
      setSku("");
      setItemName("");
      showNotification(`Produk '${itemName}' (${sku}) berhasil ditambahkan.`);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaChannel.trim()) return;
    setIsSubmitting(true);
    try {
      await api.createChannel({
        nama_channel: namaChannel.trim(),
        color: channelColor.trim() || undefined,
      });
      setNamaChannel("");
      setChannelColor("#10B981");
      showNotification(`Channel '${namaChannel}' berhasil ditambahkan.`);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaStatus.trim()) return;
    setIsSubmitting(true);
    try {
      await api.createOrderStatus({
        nama_status: namaStatus.trim(),
        color: colorStatus.trim() || undefined,
        urutan: Number(urutanStatus) || 1,
        is_final: isFinalStatus,
        next_status: nextStatus.trim() || undefined,
      });
      setNamaStatus("");
      setColorStatus("#3B82F6");
      setUrutanStatus((orderStatuses.length || 0) + 2);
      setNextStatus("");
      setIsFinalStatus(false);
      showNotification(`Status Nota '${namaStatus}' berhasil ditambahkan.`);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaCustomer.trim()) return;
    setIsSubmitting(true);
    try {
      await api.createCustomer({
        nama_customer: namaCustomer.trim(),
        no_telepon: teleponCustomer.trim() || undefined,
        alamat: alamatCustomer.trim() || undefined,
      });
      setNamaCustomer("");
      setTeleponCustomer("");
      setAlamatCustomer("");
      showNotification(`Customer '${namaCustomer}' berhasil ditambahkan.`);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers for Delete Confirmation ---
  const handleDeleteDivisi = (id: number, name: string) => {
    setEditingDivisi(null);
    setDeleteModal({
      isOpen: true,
      title: "Hapus Divisi",
      message: `Apakah Anda yakin ingin menghapus divisi '${name}' beserta data sales person yang terkait?`,
      isLoading: false,
      onConfirm: async () => {
        setDeleteModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteDivisi(id);
          showNotification(`Divisi '${name}' berhasil dihapus.`);
          setDeleteModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          onRefresh();
        } catch (err: any) {
          showNotification(err.message, true);
          setDeleteModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleDeleteSales = (id: number, name: string) => {
    setEditingSales(null);
    setDeleteModal({
      isOpen: true,
      title: "Hapus Sales Person",
      message: `Apakah Anda yakin ingin menghapus sales person '${name}'?`,
      isLoading: false,
      onConfirm: async () => {
        setDeleteModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteSalesPerson(id);
          showNotification(`Sales person '${name}' berhasil dihapus.`);
          setDeleteModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          onRefresh();
        } catch (err: any) {
          showNotification(err.message, true);
          setDeleteModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleDeleteBrand = (id: number, name: string) => {
    setEditingBrand(null);
    setDeleteModal({
      isOpen: true,
      title: "Hapus Brand",
      message: `Apakah Anda yakin ingin menghapus brand '${name}' beserta produk yang terkait?`,
      isLoading: false,
      onConfirm: async () => {
        setDeleteModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteBrand(id);
          showNotification(`Brand '${name}' berhasil dihapus.`);
          setDeleteModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          onRefresh();
        } catch (err: any) {
          showNotification(err.message, true);
          setDeleteModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleDeleteGroup = (id: number, name: string) => {
    setEditingGroup(null);
    setDeleteModal({
      isOpen: true,
      title: "Hapus Group Item",
      message: `Apakah Anda yakin ingin menghapus group '${name}'?`,
      isLoading: false,
      onConfirm: async () => {
        setDeleteModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteItemGroup(id);
          showNotification(`Group '${name}' berhasil dihapus.`);
          setDeleteModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          onRefresh();
        } catch (err: any) {
          showNotification(err.message, true);
          setDeleteModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleDeleteCategory = (id: number, name: string) => {
    setEditingCategory(null);
    setDeleteModal({
      isOpen: true,
      title: "Hapus Kategori",
      message: `Apakah Anda yakin ingin menghapus kategori '${name}'?`,
      isLoading: false,
      onConfirm: async () => {
        setDeleteModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteCategory(id);
          showNotification(`Kategori '${name}' berhasil dihapus.`);
          setDeleteModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          onRefresh();
        } catch (err: any) {
          showNotification(err.message, true);
          setDeleteModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleDeleteProduct = (skuCode: string, name: string) => {
    setEditingProduct(null);
    setDeleteModal({
      isOpen: true,
      title: "Hapus Produk",
      message: `Apakah Anda yakin ingin menghapus produk '${name}' (${skuCode})?`,
      isLoading: false,
      onConfirm: async () => {
        setDeleteModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteProduct(skuCode);
          showNotification(`Produk '${name}' berhasil dihapus.`);
          setDeleteModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          onRefresh();
        } catch (err: any) {
          showNotification(err.message, true);
          setDeleteModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleDeleteChannel = (id: number, name: string) => {
    setEditingChannel(null);
    setDeleteModal({
      isOpen: true,
      title: "Hapus Channel Penjualan",
      message: `Apakah Anda yakin ingin menghapus channel '${name}'?`,
      isLoading: false,
      onConfirm: async () => {
        setDeleteModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteChannel(id);
          showNotification(`Channel '${name}' berhasil dihapus.`);
          setDeleteModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          onRefresh();
        } catch (err: any) {
          showNotification(err.message, true);
          setDeleteModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleDeleteStatus = (id: number, name: string) => {
    setEditingStatus(null);
    setDeleteModal({
      isOpen: true,
      title: "Hapus Status Nota",
      message: `Apakah Anda yakin ingin menghapus status nota '${name}'?`,
      isLoading: false,
      onConfirm: async () => {
        setDeleteModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteOrderStatus(id);
          showNotification(`Status Nota '${name}' berhasil dihapus.`);
          setDeleteModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          onRefresh();
        } catch (err: any) {
          showNotification(err.message, true);
          setDeleteModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleDeleteCustomer = (id: number, name: string) => {
    setEditingCustomer(null);
    setDeleteModal({
      isOpen: true,
      title: "Hapus Data Customer",
      message: `Apakah Anda yakin ingin menghapus data customer '${name}'? Data riwayat transaksi lama tidak akan terpengaruh karena menggunakan snapshot.`,
      isLoading: false,
      onConfirm: async () => {
        setDeleteModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteCustomer(id);
          showNotification(`Customer '${name}' berhasil dihapus.`);
          setDeleteModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          onRefresh();
        } catch (err: any) {
          showNotification(err.message, true);
          setDeleteModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  // --- Handlers for Update (Save Edit) ---
  const handleSaveEditDivisi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDivisi || !editDivisiName.trim()) return;
    setIsUpdating(true);
    try {
      await api.updateDivisi(editingDivisi.id, editDivisiName.trim());
      showNotification(`Divisi '${editDivisiName}' berhasil diperbarui.`);
      setEditingDivisi(null);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEditSales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSales || !editSalesName.trim() || !editSalesDivisiId) {
      showNotification("Nama sales dan divisi wajib diisi!", true);
      return;
    }
    setIsUpdating(true);
    try {
      await api.updateSalesPerson(editingSales.id, {
        nama_sales: editSalesName.trim(),
        divisi_id: editSalesDivisiId,
      });
      showNotification(`Sales '${editSalesName}' berhasil diperbarui.`);
      setEditingSales(null);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEditBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand || !editBrandName.trim()) return;
    setIsUpdating(true);
    try {
      await api.updateBrand(editingBrand.id, editBrandName.trim());
      showNotification(`Brand '${editBrandName}' berhasil diperbarui.`);
      setEditingBrand(null);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editGroupName.trim()) return;
    setIsUpdating(true);
    try {
      await api.updateItemGroup(editingGroup.id, editGroupName.trim());
      showNotification(`Group '${editGroupName}' berhasil diperbarui.`);
      setEditingGroup(null);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCategoryName.trim()) return;
    setIsUpdating(true);
    try {
      await api.updateCategory(editingCategory.id, editCategoryName.trim());
      showNotification(`Kategori '${editCategoryName}' berhasil diperbarui.`);
      setEditingCategory(null);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editItemName.trim() || !editBrandId) {
      showNotification("Nama Produk dan Brand wajib diisi!", true);
      return;
    }
    setIsUpdating(true);
    try {
      await api.updateProduct(editingProduct.sku, {
        item_name: editItemName.trim(),
        brand_id: editBrandId,
        item_group: editItemGroup || null,
        category: editCategory || null,
      });
      showNotification(`Produk '${editItemName}' (${editingProduct.sku}) berhasil diperbarui.`);
      setEditingProduct(null);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEditChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel || !editChannelName.trim()) return;
    setIsUpdating(true);
    try {
      await api.updateChannel(editingChannel.id, {
        nama_channel: editChannelName.trim(),
        color: editChannelColor.trim() || undefined,
      });
      showNotification(`Channel '${editChannelName}' berhasil diperbarui.`);
      setEditingChannel(null);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEditStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStatus || !editStatusName.trim()) return;
    setIsUpdating(true);
    try {
      await api.updateOrderStatusMaster(editingStatus.id, {
        nama_status: editStatusName.trim(),
        color: editStatusColor.trim() || undefined,
        urutan: Number(editStatusUrutan) || 1,
        is_final: editStatusIsFinal,
        next_status: editStatusNext.trim() || undefined,
      });
      showNotification(`Status Nota '${editStatusName}' berhasil diperbarui.`);
      setEditingStatus(null);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editCustomerName.trim()) return;
    setIsUpdating(true);
    try {
      await api.updateCustomer(editingCustomer.id, {
        nama_customer: editCustomerName.trim(),
        no_telepon: editCustomerPhone.trim() || undefined,
        alamat: editCustomerAddress.trim() || undefined,
      });
      showNotification(`Customer '${editCustomerName}' berhasil diperbarui.`);
      setEditingCustomer(null);
      onRefresh();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setIsUpdating(false);
    }
  };

  // --- Cell Click Handlers for SimpleTable ---
  const handleDivisiCellClick = ({ row }: { row: Divisi }) => {
    if (!row) return;
    setEditingDivisi(row);
    setEditDivisiName(row.nama_divisi);
  };

  const handleSalesCellClick = ({ row }: { row: SalesPerson }) => {
    if (!row) return;
    setEditingSales(row);
    setEditSalesName(row.nama_sales);
    setEditSalesDivisiId(row.divisi_id);
  };

  const handleBrandCellClick = ({ row }: { row: Brand }) => {
    if (!row) return;
    setEditingBrand(row);
    setEditBrandName(row.nama_brand);
  };

  const handleGroupCellClick = ({ row }: { row: ItemGroup }) => {
    if (!row) return;
    setEditingGroup(row);
    setEditGroupName(row.nama_group);
  };

  const handleCategoryCellClick = ({ row }: { row: Category }) => {
    if (!row) return;
    setEditingCategory(row);
    setEditCategoryName(row.nama_kategori);
  };

  const handleProductCellClick = ({ row }: { row: Product }) => {
    if (!row) return;
    setEditingProduct(row);
    setEditItemName(row.item_name);
    setEditBrandId(row.brand_id);
    setEditItemGroup(row.item_group || "");
    setEditCategory(row.category || "");
  };

  const handleChannelCellClick = ({ row }: { row: Channel }) => {
    if (!row) return;
    setEditingChannel(row);
    setEditChannelName(row.nama_channel);
    setEditChannelColor(row.color || getChannelColor(row.nama_channel, channels));
  };

  const handleStatusCellClick = ({ row }: { row: OrderStatusMaster }) => {
    if (!row) return;
    setEditingStatus(row);
    setEditStatusName(row.nama_status);
    setEditStatusColor(row.color || getStatusColor(row.nama_status, orderStatuses));
    setEditStatusUrutan(row.urutan ?? 1);
    setEditStatusNext(row.next_status || "");
    setEditStatusIsFinal(Boolean(row.is_final));
  };

  const handleCustomerCellClick = ({ row }: { row: Customer }) => {
    if (!row) return;
    setEditingCustomer(row);
    setEditCustomerName(row.nama_customer);
    setEditCustomerPhone(row.no_telepon || "");
    setEditCustomerAddress(row.alamat || "");
  };

  // --- Filter lists by search query ---
  const filteredDivisi = divisi.filter((d) => d.nama_divisi.toLowerCase().includes(search.toLowerCase()));
  const filteredSales = salesPersons.filter(
    (s) =>
      s.nama_sales.toLowerCase().includes(search.toLowerCase()) ||
      (s.nama_divisi || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredBrands = brands.filter((b) => b.nama_brand.toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = itemGroups.filter((g) => g.nama_group.toLowerCase().includes(search.toLowerCase()));
  const filteredCategories = categories.filter((c) => c.nama_kategori.toLowerCase().includes(search.toLowerCase()));
  const filteredProducts = products.filter(
    (p) =>
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.item_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.nama_brand || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.category || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.item_group || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredChannels = (channels || []).filter((c) =>
    c.nama_channel.toLowerCase().includes(search.toLowerCase())
  );
  const filteredOrderStatuses = (orderStatuses || [])
    .filter((s) => s.nama_status.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.urutan ?? 999) - (b.urutan ?? 999));
  const filteredCustomers = (customers || []).filter((c) =>
    c.nama_customer.toLowerCase().includes(search.toLowerCase()) ||
    (c.no_telepon || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.alamat || "").toLowerCase().includes(search.toLowerCase())
  );

  // --- SimpleTable Column Definitions (Clean, No Aksi Icons, Click Row to Edit/Delete) ---
  const productColumns: ReactColumnDef<Product>[] = useMemo(
    () => [
      {
        accessor: "sku",
        label: "SKU",
        sortable: true,
        filterable: true,
        width: 140,
        align: "center",
        cellRenderer: ({ row }) => (
          <div className="flex items-center gap-1.5 cursor-pointer">
            <span className="font-mono font-bold text-zinc-900">{row.sku}</span>
          </div>
        ),
      },
      {
        accessor: "item_name",
        label: "Nama Produk",
        sortable: true,
        filterable: true,
        width: "auto",
        minWidth: 200,
        cellRenderer: ({ row }) => (
          <div className="cursor-pointer">
            <span className="font-semibold text-zinc-900 hover:text-indigo-600 transition-colors">
              {row.item_name}
            </span>
          </div>
        ),
      },
      {
        accessor: "nama_brand",
        label: "Brand",
        sortable: true,
        filterable: true,
        width: 140,
        cellRenderer: ({ row }) => (
          <span className="text-zinc-700 font-medium cursor-pointer">{row.nama_brand || "-"}</span>
        ),
      },
      {
        accessor: "item_group",
        label: "Group / Kelompok",
        sortable: true,
        filterable: true,
        width: 140,
        cellRenderer: ({ row }) =>
          row.item_group ? (
            <span className="px-2.5 py-0.5 rounded-md bg-zinc-100 text-zinc-800 text-[11px] font-medium border border-zinc-200/60 cursor-pointer">
              {row.item_group}
            </span>
          ) : (
            <span className="text-zinc-400 cursor-pointer">-</span>
          ),
      },
      {
        accessor: "category",
        label: "Kategori",
        sortable: true,
        filterable: true,
        width: 140,
        cellRenderer: ({ row }) =>
          row.category ? (
            <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/70 text-[11px] font-medium cursor-pointer">
              {row.category}
            </span>
          ) : (
            <span className="text-zinc-400 cursor-pointer">-</span>
          ),
      },
    ],
    []
  );

  const divisiColumns: ReactColumnDef<Divisi>[] = useMemo(
    () => [
      {
        accessor: "id",
        label: "ID",
        sortable: true,
        filterable: true,
        width: 90,
        align: "center",
        cellRenderer: ({ row }) => (
          <span className="font-mono text-zinc-500 tabular cursor-pointer">#{row.id}</span>
        ),
      },
      {
        accessor: "nama_divisi",
        label: "Nama Divisi",
        sortable: true,
        filterable: true,
        width: "auto",
        minWidth: 260,
        cellRenderer: ({ row }) => (
          <div className="cursor-pointer">
            <span className="font-semibold text-zinc-900 hover:text-indigo-600 transition-colors">
              {row.nama_divisi}
            </span>
          </div>
        ),
      },
    ],
    []
  );

  const salesColumns: ReactColumnDef<SalesPerson>[] = useMemo(
    () => [
      {
        accessor: "id",
        label: "ID",
        sortable: true,
        filterable: true,
        width: 90,
        align: "center",
        cellRenderer: ({ row }) => (
          <span className="font-mono text-zinc-500 tabular cursor-pointer">#{row.id}</span>
        ),
      },
      {
        accessor: "nama_sales",
        label: "Nama Sales Person",
        sortable: true,
        filterable: true,
        width: "auto",
        minWidth: 220,
        cellRenderer: ({ row }) => (
          <div className="cursor-pointer">
            <span className="font-semibold text-zinc-900 hover:text-indigo-600 transition-colors">
              {row.nama_sales}
            </span>
          </div>
        ),
      },
      {
        accessor: "nama_divisi",
        label: "Divisi Terhubung",
        sortable: true,
        filterable: true,
        width: 200,
        cellRenderer: ({ row }) => (
          row.nama_divisi ? (
            <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200/60 text-[11px] font-medium cursor-pointer">
              {row.nama_divisi}
            </span>
          ) : (
            <span className="text-zinc-400 cursor-pointer">-</span>
          )
        ),
      },
    ],
    []
  );

  const brandColumns: ReactColumnDef<Brand>[] = useMemo(
    () => [
      {
        accessor: "id",
        label: "ID",
        sortable: true,
        filterable: true,
        width: 90,
        align: "center",
        cellRenderer: ({ row }) => (
          <span className="font-mono text-zinc-500 tabular cursor-pointer">#{row.id}</span>
        ),
      },
      {
        accessor: "nama_brand",
        label: "Nama Brand",
        sortable: true,
        filterable: true,
        width: "auto",
        minWidth: 260,
        cellRenderer: ({ row }) => (
          <div className="cursor-pointer">
            <span className="font-semibold text-zinc-900 hover:text-indigo-600 transition-colors">
              {row.nama_brand}
            </span>
          </div>
        ),
      },
    ],
    []
  );

  const groupColumns: ReactColumnDef<ItemGroup>[] = useMemo(
    () => [
      {
        accessor: "id",
        label: "ID",
        sortable: true,
        filterable: true,
        width: 90,
        align: "center",
        cellRenderer: ({ row }) => (
          <span className="font-mono text-zinc-500 tabular cursor-pointer">#{row.id}</span>
        ),
      },
      {
        accessor: "nama_group",
        label: "Nama Group / Kelompok Segmentasi",
        sortable: true,
        filterable: true,
        width: "auto",
        minWidth: 260,
        cellRenderer: ({ row }) => (
          <div className="cursor-pointer">
            <span className="font-semibold text-zinc-900 hover:text-indigo-600 transition-colors">
              {row.nama_group}
            </span>
          </div>
        ),
      },
    ],
    []
  );

  const categoryColumns: ReactColumnDef<Category>[] = useMemo(
    () => [
      {
        accessor: "id",
        label: "ID",
        sortable: true,
        filterable: true,
        width: 90,
        align: "center",
        cellRenderer: ({ row }) => (
          <span className="font-mono text-zinc-500 tabular cursor-pointer">#{row.id}</span>
        ),
      },
      {
        accessor: "nama_kategori",
        label: "Nama Kategori Produk",
        sortable: true,
        filterable: true,
        width: "auto",
        minWidth: 260,
        cellRenderer: ({ row }) => (
          <div className="cursor-pointer">
            <span className="font-semibold text-zinc-900 hover:text-indigo-600 transition-colors">
              {row.nama_kategori}
            </span>
          </div>
        ),
      },
    ],
    []
  );

  const channelColumns: ReactColumnDef<Channel>[] = useMemo(
    () => [
      {
        accessor: "id",
        label: "ID",
        sortable: true,
        filterable: true,
        width: 90,
        align: "center",
        cellRenderer: ({ row }) => (
          <span className="font-mono text-zinc-500 tabular cursor-pointer">#{row.id}</span>
        ),
      },
      {
        accessor: "nama_channel",
        label: "Nama Channel Penjualan",
        sortable: true,
        filterable: true,
        width: "auto",
        minWidth: 220,
        cellRenderer: ({ row }) => (
          <div className="cursor-pointer">
            <span className="font-semibold text-zinc-900 hover:text-indigo-600 transition-colors">
              {row.nama_channel}
            </span>
          </div>
        ),
      },
      {
        accessor: "color",
        label: "Warna & Badge",
        sortable: true,
        filterable: false,
        width: 220,
        cellRenderer: ({ row }) => {
          const colorHex = row.color || getChannelColor(row.nama_channel, channels);
          const badgeStyle = getDynamicBadgeStyle(colorHex);
          return (
            <div className="flex items-center gap-2.5 cursor-pointer">
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0 shadow-2xs"
                style={{ backgroundColor: colorHex }}
              />
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border"
                style={badgeStyle}
              >
                {row.nama_channel}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">{colorHex}</span>
            </div>
          );
        },
      },
    ],
    [channels]
  );

  const orderStatusColumns: ReactColumnDef<OrderStatusMaster>[] = useMemo(
    () => [
      {
        accessor: "urutan",
        label: "Urutan",
        sortable: true,
        filterable: true,
        width: 90,
        align: "center",
        cellRenderer: ({ row }) => (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 text-zinc-800 font-bold text-xs font-mono">
            {row.urutan ?? "-"}
          </span>
        ),
      },
      {
        accessor: "nama_status",
        label: "Nama Status Nota & Badge Preview",
        sortable: true,
        filterable: true,
        width: "auto",
        minWidth: 240,
        cellRenderer: ({ row }) => {
          const colorHex = row.color || getStatusColor(row.nama_status, orderStatuses);
          const badgeStyle = getDynamicBadgeStyle(colorHex);
          return (
            <div className="flex items-center gap-2.5 cursor-pointer">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border shadow-2xs"
                style={badgeStyle}
              >
                {row.nama_status}
              </span>
            </div>
          );
        },
      },
      {
        accessor: "color",
        label: "Warna Hex",
        sortable: true,
        filterable: false,
        width: 140,
        cellRenderer: ({ row }) => {
          const colorHex = row.color || getStatusColor(row.nama_status, orderStatuses);
          return (
            <div className="flex items-center gap-2 cursor-pointer font-mono text-xs text-zinc-600">
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: colorHex }}
              />
              <span>{colorHex}</span>
            </div>
          );
        },
      },
      {
        accessor: "next_status",
        label: "Status Selanjutnya",
        sortable: true,
        filterable: true,
        width: 200,
        cellRenderer: ({ row }) => {
          if (!row.next_status) {
            return <span className="text-zinc-400 text-xs italic">— Tidak ada</span>;
          }
          const nextColor = getStatusColor(row.next_status, orderStatuses);
          const nextBadge = getDynamicBadgeStyle(nextColor);
          return (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border"
              style={nextBadge}
            >
              <span>→</span>
              <span>{row.next_status}</span>
            </span>
          );
        },
      },
      {
        accessor: "is_final",
        label: "Tipe Tahap",
        sortable: true,
        filterable: true,
        width: 130,
        align: "center",
        cellRenderer: ({ row }) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              row.is_final
                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                : "bg-blue-50 text-blue-700 border border-blue-200"
            }`}
          >
            {row.is_final ? "Tahap Final" : "Dalam Proses"}
          </span>
        ),
      },
    ],
    [orderStatuses]
  );

  const customerColumns: ReactColumnDef<Customer>[] = useMemo(
    () => [
      {
        accessor: "id",
        label: "ID",
        sortable: true,
        filterable: true,
        width: 130,
        align: "center",
        cellRenderer: ({ row }) => (
          <span className="font-mono text-zinc-500 tabular cursor-pointer">#{row.id}</span>
        ),
      },
      {
        accessor: "nama_customer",
        label: "Nama Pelanggan / Customer",
        sortable: true,
        filterable: true,
        width: "auto",
        minWidth: 220,
        cellRenderer: ({ row }) => (
          <div className="cursor-pointer">
            <span className="font-semibold text-zinc-900 hover:text-emerald-700 transition-colors">
              {row.nama_customer}
            </span>
          </div>
        ),
      },
      {
        accessor: "no_telepon",
        label: "No. Telepon / WhatsApp",
        sortable: true,
        filterable: true,
        width: 180,
        cellRenderer: ({ row }) => (
          <span className="font-mono text-zinc-600 text-xs cursor-pointer">
            {row.no_telepon || "-"}
          </span>
        ),
      },
      {
        accessor: "alamat",
        label: "Alamat Lengkap",
        sortable: true,
        filterable: true,
        width: "auto",
        minWidth: 260,
        cellRenderer: ({ row }) => (
          <span className="text-zinc-600 text-xs truncate cursor-pointer">
            {row.alamat || "-"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200" id="master-data-view">
      {/* Header */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Master Data CRUD
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-display">
          Kelola Master Data ERP
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Manajemen data master Divisi, Sales Person, Brand, Group, Kategori, dan Produk di database MongoDB.
        </p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in slide-in-from-top-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2 animate-in shake">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Master Tabs & Action Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-zinc-200">
        <div className="flex items-center gap-1.5 flex-wrap" id="master-tabs-bar">
          {[
            { id: "divisi" as MasterTab, label: "1. Divisi", icon: Building2, count: divisi.length },
            { id: "sales" as MasterTab, label: "2. Sales Person", icon: Users, count: salesPersons.length },
            { id: "brand" as MasterTab, label: "3. Brand", icon: Tag, count: brands.length },
            { id: "group" as MasterTab, label: "4. Group", icon: FolderTree, count: itemGroups.length },
            { id: "category" as MasterTab, label: "5. Kategori", icon: Boxes, count: categories.length },
            { id: "product" as MasterTab, label: "6. Produk", icon: ShoppingBag, count: products.length },
            { id: "channel" as MasterTab, label: "7. Channel", icon: Tag, count: (channels || []).length },
            { id: "customers" as MasterTab, label: "8. Customers", icon: Users, count: (customers || []).length },
            { id: "status" as MasterTab, label: "9. Status Nota", icon: Workflow, count: (orderStatuses || []).length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`master-tab-${tab.id}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearch("");
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full tabular ${
                    isActive ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Bulk Import Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Cari di ${activeTab}...`}
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 w-44 sm:w-52"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeTab === "divisi") downloadSingleMasterTemplate("divisi");
              else if (activeTab === "sales") downloadSingleMasterTemplate("sales_person");
              else if (activeTab === "brand") downloadSingleMasterTemplate("brand");
              else if (activeTab === "group") downloadSingleMasterTemplate("item_group");
              else if (activeTab === "category") downloadSingleMasterTemplate("category");
              else if (activeTab === "product") downloadSingleMasterTemplate("products");
              else if (activeTab === "channel") downloadSingleMasterTemplate("channel");
              else if (activeTab === "customers") downloadSingleMasterTemplate("customers");
              else if (activeTab === "status") downloadSingleMasterTemplate("order_status");
            }}
            title="Download Template Excel untuk tab ini"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden sm:inline">Template Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            id="import-master-excel-btn"
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Import Excel</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Divisi */}
      {activeTab === "divisi" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="master-divisi-panel">
          {/* Form Create */}
          <div className="lg:col-span-4 bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <Building2 className="w-4 h-4 text-zinc-700" />
              <h3 className="font-bold text-sm text-zinc-900 font-display">Tambah Divisi Baru</h3>
            </div>
            <form onSubmit={handleAddDivisi} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Divisi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nama-divisi-input"
                  value={namaDivisi}
                  onChange={(e) => setNamaDivisi(e.target.value)}
                  placeholder="Contoh: Digital Marketing / Retail"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                id="submit-divisi-btn"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Divisi</span>
              </button>
            </form>
          </div>

          {/* Table List */}
          <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800">
                Data Divisi ({filteredDivisi.length})
              </span>
              <div className="text-[11px] text-zinc-600 flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5 text-zinc-400" />
                <span>Klik baris / sel untuk edit & hapus</span>
              </div>
            </div>
            <SimpleTable<Divisi>
              rows={filteredDivisi}
              columns={divisiColumns}
              theme="custom"
              customTheme={{ rowHeight: 46, headerHeight: 38 }}
              height="450px"
              getRowId={({ row }) => String(row.id)}
              onCellClick={handleDivisiCellClick}
              columnResizing={true}
              columnReordering={true}
              autoExpandColumns={true}
              icons={simpleTableIcons}
              hoverRowBackground={true}
              oddEvenRowBackground={true}
              tableEmptyStateRenderer={
                <div className="py-12 text-center text-zinc-400">
                  <p className="text-xs font-semibold text-zinc-700">Belum ada data divisi</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Tambahkan divisi baru melalui formulir di samping.</p>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Tab 2: Sales Person */}
      {activeTab === "sales" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="master-sales-panel">
          {/* Form Create */}
          <div className="lg:col-span-4 bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <Users className="w-4 h-4 text-zinc-700" />
              <h3 className="font-bold text-sm text-zinc-900 font-display">Tambah Sales Person</h3>
            </div>
            <form onSubmit={handleAddSales} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Sales <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nama-sales-input"
                  value={namaSales}
                  onChange={(e) => setNamaSales(e.target.value)}
                  placeholder="Contoh: Rian Pratama"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Pilih Divisi (Dropdown) <span className="text-red-500">*</span>
                </label>
                <SearchableSelect<Divisi>
                  items={divisi}
                  value={selectedDivisiId}
                  onChange={(id) => setSelectedDivisiId(id ? Number(id) : null)}
                  getId={(d: Divisi) => d.id}
                  getLabel={(d: Divisi) => d.nama_divisi}
                  placeholder="Pilih Divisi..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                id="submit-sales-btn"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Sales Person</span>
              </button>
            </form>
          </div>

          {/* Table List */}
          <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800">
                Data Sales Person ({filteredSales.length})
              </span>
              <div className="text-[11px] text-zinc-600 flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5 text-zinc-400" />
                <span>Klik baris / sel untuk edit & hapus</span>
              </div>
            </div>
            <SimpleTable<SalesPerson>
              rows={filteredSales}
              columns={salesColumns}
              theme="custom"
              customTheme={{ rowHeight: 46, headerHeight: 38 }}
              height="450px"
              getRowId={({ row }) => String(row.id)}
              onCellClick={handleSalesCellClick}
              columnResizing={true}
              columnReordering={true}
              autoExpandColumns={true}
              icons={simpleTableIcons}
              hoverRowBackground={true}
              oddEvenRowBackground={true}
              tableEmptyStateRenderer={
                <div className="py-12 text-center text-zinc-400">
                  <p className="text-xs font-semibold text-zinc-700">Belum ada sales person</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Tambahkan sales person baru melalui formulir di samping.</p>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Tab 3: Brand */}
      {activeTab === "brand" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="master-brand-panel">
          {/* Form Create */}
          <div className="lg:col-span-4 bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <Tag className="w-4 h-4 text-zinc-700" />
              <h3 className="font-bold text-sm text-zinc-900 font-display">Tambah Brand Baru</h3>
            </div>
            <form onSubmit={handleAddBrand} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Brand <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nama-brand-input"
                  value={namaBrand}
                  onChange={(e) => setNamaBrand(e.target.value)}
                  placeholder="Contoh: Puma / Converse"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                id="submit-brand-btn"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Brand</span>
              </button>
            </form>
          </div>

          {/* Table List */}
          <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800">
                Data Brand ({filteredBrands.length})
              </span>
              <div className="text-[11px] text-zinc-600 flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5 text-zinc-400" />
                <span>Klik baris / sel untuk edit & hapus</span>
              </div>
            </div>
            <SimpleTable<Brand>
              rows={filteredBrands}
              columns={brandColumns}
              theme="custom"
              customTheme={{ rowHeight: 46, headerHeight: 38 }}
              height="450px"
              getRowId={({ row }) => String(row.id)}
              onCellClick={handleBrandCellClick}
              columnResizing={true}
              columnReordering={true}
              autoExpandColumns={true}
              icons={simpleTableIcons}
              hoverRowBackground={true}
              oddEvenRowBackground={true}
              tableEmptyStateRenderer={
                <div className="py-12 text-center text-zinc-400">
                  <p className="text-xs font-semibold text-zinc-700">Belum ada data brand</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Tambahkan brand baru melalui formulir di samping.</p>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Tab 4: Group */}
      {activeTab === "group" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="master-group-panel">
          {/* Form Create */}
          <div className="lg:col-span-4 bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <FolderTree className="w-4 h-4 text-zinc-700" />
              <h3 className="font-bold text-sm text-zinc-900 font-display">Tambah Group Baru</h3>
            </div>
            <p className="text-xs text-zinc-500">
              Group / Kelompok segmentasi produk (misal: Iphone 15, Iphone 16, Flagship Series).
            </p>
            <form onSubmit={handleAddGroup} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Group <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nama-group-input"
                  value={namaGroup}
                  onChange={(e) => setNamaGroup(e.target.value)}
                  placeholder="Contoh: Iphone 15 / Flagship Series"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                id="submit-group-btn"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Group</span>
              </button>
            </form>
          </div>

          {/* Table List */}
          <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800">
                Data Group ({filteredGroups.length})
              </span>
              <div className="text-[11px] text-zinc-600 flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5 text-zinc-400" />
                <span>Klik baris / sel untuk edit & hapus</span>
              </div>
            </div>
            <SimpleTable<ItemGroup>
              rows={filteredGroups}
              columns={groupColumns}
              theme="custom"
              customTheme={{ rowHeight: 46, headerHeight: 38 }}
              height="450px"
              getRowId={({ row }) => String(row.id)}
              onCellClick={handleGroupCellClick}
              columnResizing={true}
              columnReordering={true}
              autoExpandColumns={true}
              icons={simpleTableIcons}
              hoverRowBackground={true}
              oddEvenRowBackground={true}
              tableEmptyStateRenderer={
                <div className="py-12 text-center text-zinc-400">
                  <p className="text-xs font-semibold text-zinc-700">Belum ada data group</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Tambahkan group baru melalui formulir di samping.</p>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Tab 5: Kategori */}
      {activeTab === "category" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="master-category-panel">
          {/* Form Create */}
          <div className="lg:col-span-4 bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <Boxes className="w-4 h-4 text-zinc-700" />
              <h3 className="font-bold text-sm text-zinc-900 font-display">Tambah Kategori Baru</h3>
            </div>
            <p className="text-xs text-zinc-500">
              Kategori jenis barang (misal: Handphone, Laptop, Camera Action, Aksesoris).
            </p>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nama-category-input"
                  value={namaKategori}
                  onChange={(e) => setNamaKategori(e.target.value)}
                  placeholder="Contoh: Handphone / Laptop / Aksesoris"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                id="submit-category-btn"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Kategori</span>
              </button>
            </form>
          </div>

          {/* Table List */}
          <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800">
                Data Kategori ({filteredCategories.length})
              </span>
              <div className="text-[11px] text-zinc-600 flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5 text-zinc-400" />
                <span>Klik baris / sel untuk edit & hapus</span>
              </div>
            </div>
            <SimpleTable<Category>
              rows={filteredCategories}
              columns={categoryColumns}
              theme="custom"
              customTheme={{ rowHeight: 46, headerHeight: 38 }}
              height="450px"
              getRowId={({ row }) => String(row.id)}
              onCellClick={handleCategoryCellClick}
              columnResizing={true}
              columnReordering={true}
              autoExpandColumns={true}
              icons={simpleTableIcons}
              hoverRowBackground={true}
              oddEvenRowBackground={true}
              tableEmptyStateRenderer={
                <div className="py-12 text-center text-zinc-400">
                  <p className="text-xs font-semibold text-zinc-700">Belum ada data kategori</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Tambahkan kategori baru melalui formulir di samping.</p>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Tab 6: Products */}
      {activeTab === "product" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="master-product-panel">
          {/* Form Create */}
          <div className="lg:col-span-4 bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <ShoppingBag className="w-4 h-4 text-zinc-700" />
              <h3 className="font-bold text-sm text-zinc-900 font-display">Tambah Produk Baru</h3>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-3">
              {/* SKU */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Kode SKU (Primary Key Unik) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="sku-input"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Contoh: IP15-128-RED"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 font-mono uppercase"
                />
              </div>

              {/* Item Name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Produk <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="item-name-input"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Contoh: Iphone 15 128GB Red"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              {/* Brand Select (Searchable) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Brand (Searchable Dropdown) <span className="text-red-500">*</span>
                </label>
                <SearchableSelect<Brand>
                  items={brands}
                  value={selectedBrandId}
                  onChange={(id) => setSelectedBrandId(id ? Number(id) : null)}
                  getId={(b: Brand) => b.id}
                  getLabel={(b: Brand) => b.nama_brand}
                  placeholder="Pilih Brand..."
                />
              </div>

              {/* Item Group & Category from Dynamic Master Data */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-700">Group (Kelompok)</label>
                  <select
                    value={itemGroup}
                    onChange={(e) => setItemGroup(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                  >
                    {itemGroups.length === 0 ? (
                      <option value="">(Belum ada Group)</option>
                    ) : (
                      <>
                        <option value="">-- Pilih Group --</option>
                        {itemGroups.map((g) => (
                          <option key={g.id} value={g.nama_group}>
                            {g.nama_group}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-700">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                  >
                    {categories.length === 0 ? (
                      <option value="">(Belum ada Kategori)</option>
                    ) : (
                      <>
                        <option value="">-- Pilih Kategori --</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.nama_kategori}>
                            {c.nama_kategori}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                id="submit-product-btn"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors shadow-2xs disabled:opacity-50 mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Produk</span>
              </button>
            </form>
          </div>

          {/* Table List */}
          <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800">
                Katalog Produk ({filteredProducts.length})
              </span>
              <div className="text-[11px] text-zinc-600 flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5 text-zinc-400" />
                <span>Klik baris / sel untuk edit & hapus</span>
              </div>
            </div>
            <SimpleTable<Product>
              rows={filteredProducts}
              columns={productColumns}
              icons={simpleTableIcons}
              theme="custom"
              customTheme={{ rowHeight: 46, headerHeight: 38 }}
              height="550px"
              getRowId={({ row }) => row.sku}
              onCellClick={handleProductCellClick}
              columnResizing={true}
              columnReordering={true}
              autoExpandColumns={true}
              hoverRowBackground={true}
              oddEvenRowBackground={true}
              tableEmptyStateRenderer={
                <div className="py-12 text-center text-zinc-400">
                  <p className="text-xs font-semibold text-zinc-700">Belum ada produk</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Tambahkan produk baru melalui formulir di samping.</p>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Tab 7: Channel */}
      {activeTab === "channel" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="master-channel-panel">
          {/* Form Create */}
          <div className="lg:col-span-4 bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <Tag className="w-4 h-4 text-zinc-700" />
              <h3 className="font-bold text-sm text-zinc-900 font-display">Tambah Channel Baru</h3>
            </div>
            <p className="text-xs text-zinc-500">
              Kelola daftar channel penjualan (misal: Tokopedia, Shopee, TikTok Shop, Lazada, Offline Store, WhatsApp, B2B).
            </p>
            <form onSubmit={handleAddChannel} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Channel <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nama-channel-input"
                  value={namaChannel}
                  onChange={(e) => setNamaChannel(e.target.value)}
                  placeholder="Contoh: Shopee / WhatsApp / Offline"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              {/* Color Customizer */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Warna Tema & Badge Channel
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={channelColor}
                    onChange={(e) => setChannelColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-200 p-0.5 shrink-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={channelColor}
                    onChange={(e) => setChannelColor(e.target.value)}
                    placeholder="#10B981"
                    maxLength={7}
                    className="w-24 px-2.5 py-1.5 font-mono text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                  />
                  {/* Live Badge Preview */}
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400 font-medium">Preview:</span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border"
                      style={getDynamicBadgeStyle(channelColor)}
                    >
                      {namaChannel.trim() || "Sample"}
                    </span>
                  </div>
                </div>

                {/* Preset Palettes */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRESET_COLORS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setChannelColor(p.hex)}
                      title={`${p.name} (${p.hex})`}
                      className={`w-5 h-5 rounded-full border transition-transform ${
                        channelColor.toLowerCase() === p.hex.toLowerCase()
                          ? "scale-125 border-zinc-900 ring-2 ring-zinc-400/50"
                          : "border-black/10 hover:scale-110"
                      }`}
                      style={{ backgroundColor: p.hex }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                id="submit-channel-btn"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors shadow-2xs disabled:opacity-50 mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Channel</span>
              </button>
            </form>
          </div>

          {/* Table List */}
          <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800">
                Data Channel Penjualan ({filteredChannels.length})
              </span>
              <div className="text-[11px] text-zinc-600 flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5 text-zinc-400" />
                <span>Klik baris / sel untuk edit & hapus</span>
              </div>
            </div>
            <SimpleTable<Channel>
              rows={filteredChannels}
              columns={channelColumns}
              theme="custom"
              customTheme={{ rowHeight: 46, headerHeight: 38 }}
              height="450px"
              getRowId={({ row }) => String(row.id)}
              onCellClick={handleChannelCellClick}
              columnResizing={true}
              columnReordering={true}
              autoExpandColumns={true}
              icons={simpleTableIcons}
              hoverRowBackground={true}
              oddEvenRowBackground={true}
              tableEmptyStateRenderer={
                <div className="py-12 text-center text-zinc-400">
                  <p className="text-xs font-semibold text-zinc-700">Belum ada data channel</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Tambahkan channel baru melalui formulir di samping.</p>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Tab 8: Customers */}
      {activeTab === "customers" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="master-customer-panel">
          {/* Form Create */}
          <div className="lg:col-span-4 bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <Users className="w-4 h-4 text-emerald-700" />
              <h3 className="font-bold text-sm text-zinc-900 font-display">Tambah Customer Baru</h3>
            </div>
            <p className="text-xs text-zinc-500">
              Kelola master pelanggan untuk memudahkan pencarian saat input order penjualan. Data transaksi lama terlindungi oleh snapshot.
            </p>
            <form onSubmit={handleAddCustomer} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Customer / Pelanggan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nama-customer-input"
                  value={namaCustomer}
                  onChange={(e) => setNamaCustomer(e.target.value)}
                  placeholder="Contoh: PT Sumber Rejeki / Ibu Maya"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  No. Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  id="telepon-customer-input"
                  value={teleponCustomer}
                  onChange={(e) => setTeleponCustomer(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Alamat Lengkap
                </label>
                <textarea
                  id="alamat-customer-input"
                  value={alamatCustomer}
                  onChange={(e) => setAlamatCustomer(e.target.value)}
                  placeholder="Contoh: Jl. Sudirman No. 12, Jakarta"
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                id="submit-customer-btn"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Customer</span>
              </button>
            </form>
          </div>

          {/* Table List */}
          <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800">
                Data Master Customer ({filteredCustomers.length})
              </span>
              <div className="text-[11px] text-zinc-600 flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5 text-zinc-400" />
                <span>Klik baris / sel untuk edit & hapus</span>
              </div>
            </div>
            <SimpleTable<Customer>
              rows={filteredCustomers}
              columns={customerColumns}
              theme="custom"
              customTheme={{ rowHeight: 46, headerHeight: 38 }}
              height="450px"
              getRowId={({ row }) => String(row.id)}
              onCellClick={handleCustomerCellClick}
              columnResizing={true}
              columnReordering={true}
              autoExpandColumns={true}
              icons={simpleTableIcons}
              hoverRowBackground={true}
              oddEvenRowBackground={true}
              tableEmptyStateRenderer={
                <div className="py-12 text-center text-zinc-400">
                  <p className="text-xs font-semibold text-zinc-700">Belum ada data customer</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Tambahkan customer baru melalui formulir di samping atau Import Excel.</p>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Tab 9: Status Nota */}
      {activeTab === "status" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="master-status-panel">
          {/* Form Create */}
          <div className="lg:col-span-4 bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <Workflow className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-zinc-900 font-display">Tambah Status Nota Baru</h3>
            </div>
            <p className="text-xs text-zinc-500">
              Kelola status transaksi penjualan (misal: Input Orderan, Diproses, Selesai Packing, Batal, Retur) beserta warna badge dan urutan alur kerjanya.
            </p>
            <form onSubmit={handleAddStatus} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Status Nota <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nama-status-input"
                  value={namaStatus}
                  onChange={(e) => setNamaStatus(e.target.value)}
                  placeholder="Contoh: Input Orderan / Diproses / Retur"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              {/* Urutan Workflow */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Urutan Workflow <span className="text-zinc-400 font-normal">(Tahap ke-berapa)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  id="urutan-status-input"
                  value={urutanStatus}
                  onChange={(e) => setUrutanStatus(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              {/* Color Customizer */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Warna Badge & Dashboard
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorStatus}
                    onChange={(e) => setColorStatus(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-200 p-0.5 shrink-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={colorStatus}
                    onChange={(e) => setColorStatus(e.target.value)}
                    placeholder="#3B82F6"
                    maxLength={7}
                    className="w-24 px-2.5 py-1.5 font-mono text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                  />
                  {/* Live Badge Preview */}
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400 font-medium">Preview:</span>
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border shadow-2xs"
                      style={getDynamicBadgeStyle(colorStatus)}
                    >
                      {namaStatus.trim() || "Preview"}
                    </span>
                  </div>
                </div>

                {/* Preset Palettes */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRESET_COLORS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setColorStatus(p.hex)}
                      title={`${p.name} (${p.hex})`}
                      className={`w-5 h-5 rounded-full border transition-transform ${
                        colorStatus.toLowerCase() === p.hex.toLowerCase()
                          ? "scale-125 border-zinc-900 ring-2 ring-zinc-400/50"
                          : "border-black/10 hover:scale-110"
                      }`}
                      style={{ backgroundColor: p.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Status Selanjutnya */}
              <div className="space-y-1 pt-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Status Selanjutnya <span className="text-zinc-400 font-normal">(Opsional)</span>
                </label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 text-zinc-800"
                >
                  <option value="">— Tidak Ada / Selesai —</option>
                  {(orderStatuses || []).map((st) => (
                    <option key={st.id} value={st.nama_status}>
                      {st.urutan ? `[#${st.urutan}] ` : ""}{st.nama_status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Checkbox Tahap Final */}
              <div className="flex items-center gap-2 pt-1 pb-1">
                <input
                  type="checkbox"
                  id="is-final-status-checkbox"
                  checked={isFinalStatus}
                  onChange={(e) => setIsFinalStatus(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="is-final-status-checkbox" className="text-xs text-zinc-700 cursor-pointer font-medium">
                  Tandai sebagai status akhir / selesai transaksi
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                id="submit-status-btn"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs disabled:opacity-50 mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Status Nota</span>
              </button>
            </form>
          </div>

          {/* Table List */}
          <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800">
                Data Master Status Nota ({filteredOrderStatuses.length})
              </span>
              <div className="text-[11px] text-zinc-600 flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5 text-zinc-400" />
                <span>Klik baris / sel untuk edit & hapus</span>
              </div>
            </div>
            <SimpleTable<OrderStatusMaster>
              rows={filteredOrderStatuses}
              columns={orderStatusColumns}
              theme="custom"
              customTheme={{ rowHeight: 46, headerHeight: 38 }}
              height="450px"
              getRowId={({ row }) => String(row.id)}
              onCellClick={handleStatusCellClick}
              columnResizing={true}
              columnReordering={true}
              autoExpandColumns={true}
              icons={simpleTableIcons}
              hoverRowBackground={true}
              oddEvenRowBackground={true}
              tableEmptyStateRenderer={
                <div className="py-12 text-center text-zinc-400">
                  <p className="text-xs font-semibold text-zinc-700">Belum ada data status nota</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Tambahkan status baru melalui formulir di samping atau Import Excel.</p>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* --- EDIT MODALS TRIGGERED BY ONCELLCLICK --- */}

      {/* 1. Edit Divisi Modal */}
      {editingDivisi && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-zinc-700" />
                <h3 className="font-bold text-sm text-zinc-900 font-display">
                  Edit Divisi (#{editingDivisi.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingDivisi(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDivisi} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Divisi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editDivisiName}
                  onChange={(e) => setEditDivisiName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteDivisi(editingDivisi.id, editingDivisi.nama_divisi)}
                  className="flex items-center gap-1.5 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Divisi</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingDivisi(null)}
                    className="py-2 px-3 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Sales Person Modal */}
      {editingSales && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-700" />
                <h3 className="font-bold text-sm text-zinc-900 font-display">
                  Edit Sales Person (#{editingSales.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSales(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSales} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Sales Person <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editSalesName}
                  onChange={(e) => setEditSalesName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Pilih Divisi (Dropdown) <span className="text-red-500">*</span>
                </label>
                <SearchableSelect<Divisi>
                  items={divisi}
                  value={editSalesDivisiId}
                  onChange={(id) => setEditSalesDivisiId(id ? Number(id) : null)}
                  getId={(d: Divisi) => d.id}
                  getLabel={(d: Divisi) => d.nama_divisi}
                  placeholder="Pilih Divisi..."
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteSales(editingSales.id, editingSales.nama_sales)}
                  className="flex items-center gap-1.5 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Sales</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSales(null)}
                    className="py-2 px-3 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Edit Brand Modal */}
      {editingBrand && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-zinc-700" />
                <h3 className="font-bold text-sm text-zinc-900 font-display">
                  Edit Brand (#{editingBrand.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBrand(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBrand} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Brand <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editBrandName}
                  onChange={(e) => setEditBrandName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteBrand(editingBrand.id, editingBrand.nama_brand)}
                  className="flex items-center gap-1.5 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Brand</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingBrand(null)}
                    className="py-2 px-3 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Edit Group Modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-zinc-700" />
                <h3 className="font-bold text-sm text-zinc-900 font-display">
                  Edit Group Item (#{editingGroup.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditGroup} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Group / Kelompok <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteGroup(editingGroup.id, editingGroup.nama_group)}
                  className="flex items-center gap-1.5 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Group</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingGroup(null)}
                    className="py-2 px-3 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-zinc-700" />
                <h3 className="font-bold text-sm text-zinc-900 font-display">
                  Edit Kategori (#{editingCategory.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCategory} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(editingCategory.id, editingCategory.nama_kategori)}
                  className="flex items-center gap-1.5 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Kategori</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="py-2 px-3 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-zinc-700" />
                <h3 className="font-bold text-sm text-zinc-900 font-display">
                  Edit Produk ({editingProduct.sku})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProduct} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">Kode SKU</label>
                <input
                  type="text"
                  disabled
                  value={editingProduct.sku}
                  className="w-full px-3 py-2 text-xs bg-zinc-100 border border-zinc-200 rounded-lg font-mono text-zinc-500 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Produk <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Brand <span className="text-red-500">*</span>
                </label>
                <SearchableSelect<Brand>
                  items={brands}
                  value={editBrandId}
                  onChange={(id) => setEditBrandId(id ? Number(id) : null)}
                  getId={(b: Brand) => b.id}
                  getLabel={(b: Brand) => b.nama_brand}
                  placeholder="Pilih Brand..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-700">Group (Kelompok)</label>
                  <select
                    value={editItemGroup}
                    onChange={(e) => setEditItemGroup(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                  >
                    <option value="">-- Tanpa Group --</option>
                    {itemGroups.map((g) => (
                      <option key={g.id} value={g.nama_group}>
                        {g.nama_group}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-700">Kategori</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                  >
                    <option value="">-- Tanpa Kategori --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.nama_kategori}>
                        {c.nama_kategori}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-100 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(editingProduct.sku, editingProduct.item_name)}
                  className="flex items-center gap-1.5 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Produk</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="py-2 px-3 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Edit Channel Modal */}
      {editingChannel && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-zinc-700" />
                <h3 className="font-bold text-sm text-zinc-900 font-display">
                  Edit Channel Penjualan (#{editingChannel.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingChannel(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditChannel} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Channel <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editChannelName}
                  onChange={(e) => setEditChannelName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              {/* Color Customizer */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Warna Tema & Badge Channel
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editChannelColor}
                    onChange={(e) => setEditChannelColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-200 p-0.5 shrink-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={editChannelColor}
                    onChange={(e) => setEditChannelColor(e.target.value)}
                    placeholder="#10B981"
                    maxLength={7}
                    className="w-24 px-2.5 py-1.5 font-mono text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                  />
                  {/* Live Badge Preview */}
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400 font-medium">Preview:</span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border"
                      style={getDynamicBadgeStyle(editChannelColor)}
                    >
                      {editChannelName.trim() || "Sample"}
                    </span>
                  </div>
                </div>

                {/* Preset Palettes */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRESET_COLORS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setEditChannelColor(p.hex)}
                      title={`${p.name} (${p.hex})`}
                      className={`w-5 h-5 rounded-full border transition-transform ${
                        editChannelColor.toLowerCase() === p.hex.toLowerCase()
                          ? "scale-125 border-zinc-900 ring-2 ring-zinc-400/50"
                          : "border-black/10 hover:scale-110"
                      }`}
                      style={{ backgroundColor: p.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteChannel(editingChannel.id, editingChannel.nama_channel)}
                  className="flex items-center gap-1.5 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Channel</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingChannel(null)}
                    className="py-2 px-3 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-sm text-zinc-900 font-display">
                  Edit Customer (#{editingCustomer.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Customer / Pelanggan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  No. Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Alamat Lengkap
                </label>
                <textarea
                  value={editCustomerAddress}
                  onChange={(e) => setEditCustomerAddress(e.target.value)}
                  placeholder="Alamat customer"
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteCustomer(editingCustomer.id, editingCustomer.nama_customer)}
                  className="flex items-center gap-1.5 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Customer</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="py-2 px-3 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Edit Status Nota Modal */}
      {editingStatus && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-zinc-900 font-display">
                  Edit Status Nota (#{editingStatus.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStatus(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStatus} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Nama Status Nota <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editStatusName}
                  onChange={(e) => setEditStatusName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              {/* Urutan Workflow */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Urutan Workflow <span className="text-zinc-400 font-normal">(Tahap ke-berapa)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={editStatusUrutan}
                  onChange={(e) => setEditStatusUrutan(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                />
              </div>

              {/* Color Customizer */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Warna Badge & Dashboard
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editStatusColor}
                    onChange={(e) => setEditStatusColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-200 p-0.5 shrink-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={editStatusColor}
                    onChange={(e) => setEditStatusColor(e.target.value)}
                    placeholder="#3B82F6"
                    maxLength={7}
                    className="w-24 px-2.5 py-1.5 font-mono text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900"
                  />
                  {/* Live Badge Preview */}
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400 font-medium">Preview:</span>
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border shadow-2xs"
                      style={getDynamicBadgeStyle(editStatusColor)}
                    >
                      {editStatusName.trim() || "Preview"}
                    </span>
                  </div>
                </div>

                {/* Preset Palettes */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRESET_COLORS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setEditStatusColor(p.hex)}
                      title={`${p.name} (${p.hex})`}
                      className={`w-5 h-5 rounded-full border transition-transform ${
                        editStatusColor.toLowerCase() === p.hex.toLowerCase()
                          ? "scale-125 border-zinc-900 ring-2 ring-zinc-400/50"
                          : "border-black/10 hover:scale-110"
                      }`}
                      style={{ backgroundColor: p.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Status Selanjutnya */}
              <div className="space-y-1 pt-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Status Selanjutnya <span className="text-zinc-400 font-normal">(Opsional)</span>
                </label>
                <select
                  value={editStatusNext}
                  onChange={(e) => setEditStatusNext(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 text-zinc-800"
                >
                  <option value="">— Tidak Ada / Selesai —</option>
                  {(orderStatuses || [])
                    .filter((st) => st.id !== editingStatus.id)
                    .map((st) => (
                      <option key={st.id} value={st.nama_status}>
                        {st.urutan ? `[#${st.urutan}] ` : ""}{st.nama_status}
                      </option>
                    ))}
                </select>
              </div>

              {/* Checkbox Tahap Final */}
              <div className="flex items-center gap-2 pt-1 pb-1">
                <input
                  type="checkbox"
                  id="edit-is-final-status-checkbox"
                  checked={editStatusIsFinal}
                  onChange={(e) => setEditStatusIsFinal(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="edit-is-final-status-checkbox" className="text-xs text-zinc-700 cursor-pointer font-medium">
                  Tandai sebagai status akhir / selesai transaksi
                </label>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteStatus(editingStatus.id, editingStatus.nama_status)}
                  className="flex items-center gap-1.5 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Status</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingStatus(null)}
                    className="py-2 px-3 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Master Data Excel Import Modal */}
      <MasterExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setIsImportModalOpen(false);
          onRefresh();
          showNotification("Import Master Data berhasil disinkronkan ke database MongoDB.");
        }}
        defaultTab={
          activeTab === "divisi"
            ? "divisi"
            : activeTab === "sales"
            ? "sales_person"
            : activeTab === "brand"
            ? "brand"
            : activeTab === "group"
            ? "item_group"
            : activeTab === "category"
            ? "category"
            : activeTab === "channel"
            ? "channel"
            : activeTab === "status"
            ? "order_status"
            : activeTab === "customers"
            ? "customers"
            : "products"
        }
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.title}
        message={deleteModal.message}
        isLoading={deleteModal.isLoading}
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={deleteModal.onConfirm}
        onCancel={() => {
          if (!deleteModal.isLoading) {
            setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          }
        }}
      />
    </div>
  );
};
