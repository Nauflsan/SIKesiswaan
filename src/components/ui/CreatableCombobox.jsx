import { useState, useRef, useEffect, useMemo } from 'preact/hooks';
import { ChevronDown, Search, Plus, Check, X } from 'lucide-preact';

/**
 * =============================================================================
 * KOMPONEN: CreatableCombobox / CustomSelect
 * =============================================================================
 * Dropdown kustom fleksibel & ringan yang mendukung:
 * 1. Mode Input Form (`variant="input"`): Ukuran form penuh, cocok untuk modal.
 * 2. Mode Filter Bar (`variant="pill"`): Ukuran compact, cocok untuk baris filter.
 * 3. In-panel Search: Filter pencarian instan berdasarkan label atau sublabel.
 * 4. Creatable: Opsi membuat entri baru secara on-the-fly jika belum ada di list.
 * 5. Dukungan Sublabel: Menampilkan info sekunder (misal kelas, poin siswa).
 * 6. Mobile-friendly: Tidak memicu native wheel picker / full-screen drawer HP.
 */
export default function CreatableCombobox({
  value = '',
  onChange,
  options = [],
  placeholder = 'Pilih opsi...',
  creatable = false,
  className = '',
  disabled = false,
  variant = 'input',
  allOptionLabel = '',
  allOptionValue = 'semua',
  searchPlaceholder = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Normalisasi opsi ke struktur konsisten { value, label, sublabel }
  const normalizedOptions = useMemo(() => {
    const list = [];
    if (allOptionLabel) {
      list.push({
        value: allOptionValue,
        label: allOptionLabel,
        isAllOption: true
      });
    }
    options.forEach(opt => {
      if (typeof opt === 'object' && opt !== null) {
        list.push({
          value: String(opt.value),
          label: opt.label || String(opt.value),
          sublabel: opt.sublabel || ''
        });
      } else {
        list.push({
          value: String(opt),
          label: String(opt),
          sublabel: ''
        });
      }
    });
    return list;
  }, [options, allOptionLabel, allOptionValue]);

  // Filter opsi sesuai input pencarian (mencocokkan label dan sublabel)
  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter(opt => {
      const matchLabel = opt.label && opt.label.toLowerCase().includes(q);
      const matchSub = opt.sublabel && opt.sublabel.toLowerCase().includes(q);
      return matchLabel || matchSub;
    });
  }, [normalizedOptions, searchTerm]);

  // Cek apakah input pencarian sudah persis sama dengan salah satu opsi
  const hasExactMatch = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return normalizedOptions.some(opt => opt.label.toLowerCase() === q);
  }, [normalizedOptions, searchTerm]);

  // Cari item terpilih saat ini
  const selectedItem = useMemo(() => {
    return normalizedOptions.find(opt => opt.value === String(value));
  }, [normalizedOptions, value]);

  // Auto-focus ke input pencarian saat panel dropdown terbuka
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Tutup dropdown jika pengguna mengklik di luar area komponen
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val) => {
    if (onChange) onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = searchTerm.trim();
      if (creatable && trimmed && !hasExactMatch) {
        handleSelect(trimmed);
      } else if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0].value);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const defaultSearchPlaceholder = searchPlaceholder || (
    creatable
      ? 'Cari atau ketik kelas baru...'
      : variant === 'pill'
        ? 'Cari...'
        : 'Cari opsi...'
  );

  return (
    <div ref={containerRef} className={`relative ${variant === 'pill' ? 'inline-block' : 'w-full'} ${className}`}>
      {/* TRIGGER BUTTON */}
      {variant === 'pill' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              if (isOpen) setSearchTerm('');
            }
          }}
          className={`inline-flex items-center justify-between gap-1.5 text-xs py-1.5 px-3 bg-gray-50 border rounded-lg font-medium transition-all ${
            isOpen
              ? 'border-[#4A6FA5] ring-1 ring-[#4A6FA5] bg-white text-[#4A6FA5]'
              : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-100'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className="truncate max-w-[130px] sm:max-w-[160px]">
            {selectedItem?.label || placeholder}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#4A6FA5]' : ''
            }`}
          />
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              if (isOpen) setSearchTerm('');
            }
          }}
          className={`w-full text-left text-sm py-2 px-3 bg-gray-50 border rounded-xl flex items-center justify-between font-medium transition-all ${
            isOpen
              ? 'border-[#4A6FA5] ring-1 ring-[#4A6FA5] bg-white'
              : 'border-gray-200 hover:border-gray-300'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="truncate min-w-0 pr-2">
            <span className={selectedItem ? 'text-gray-800' : 'text-gray-400'}>
              {selectedItem?.label || placeholder}
            </span>
            {selectedItem?.sublabel && (
              <span className="ml-2 text-xs text-gray-400 font-normal">
                ({selectedItem.sublabel})
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#4A6FA5]' : ''
            }`}
          />
        </button>
      )}

      {/* FLOATING DROPDOWN PANEL */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-64 animate-in fade-in zoom-in-95 duration-100 ${
            variant === 'pill' ? 'left-0 w-56' : 'left-0 right-0'
          }`}
        >
          {/* Kotak Pencarian */}
          <div className="p-2 border-b border-gray-100 bg-gray-50/70">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onInput={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={defaultSearchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#4A6FA5] focus:border-[#4A6FA5]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Daftar Opsi */}
          <div className="overflow-y-auto flex-1 divide-y divide-gray-50 py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full px-3 py-2 text-xs text-left flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 text-[#4A6FA5] font-bold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-gray-400 font-normal truncate mt-0.5">
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#4A6FA5] shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              !creatable && (
                <div className="px-3 py-4 text-center text-xs text-gray-400">
                  Tidak ada opsi yang cocok
                </div>
              )
            )}
          </div>

          {/* Opsi Creatable (Jika input tidak cocok dengan opsi yang ada) */}
          {creatable && searchTerm.trim() && !hasExactMatch && (
            <div className="p-1 border-t border-blue-100 bg-blue-50/40">
              <button
                type="button"
                onClick={() => handleSelect(searchTerm.trim())}
                className="w-full px-2.5 py-1.5 text-xs text-left rounded-lg text-[#4A6FA5] hover:bg-blue-100/60 font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="w-5 h-5 rounded-md bg-[#4A6FA5] text-white flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </span>
                <span className="truncate">
                  Gunakan <span className="font-bold text-gray-900">"{searchTerm.trim()}"</span> sebagai kelas baru
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
