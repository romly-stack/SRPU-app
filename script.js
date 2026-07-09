/**
 * ============================================================
 * RPU App - Main JavaScript
 * PT Rafasya Putra Ustanto
 * ============================================================
 * VERSION: 2.0
 * LAST UPDATE: 2026-07-09
 * ============================================================
 */

(function() {
    "use strict";

    // ============================================================
    // 🔐 KONFIGURASI AMAN (ENKRIPSI URL)
    // ============================================================
    
    // URL Apps Script di-enkripsi dengan Base64 + Reverse
    // Untuk mengubah: gunakan fungsi encodeUrl() di console browser
    var _URL_ENCODED = 'L2V4ZWMvU0tmeWNid0JoT3YxZ21VTjJUeFpFSy1jeUFkUk5PRld0U3RmQlU2ckE2RDZlSmNJVGdUNzR1RU5rZk4xSC1MSFBWMTRNNk0vc2NyaXB0Lmdvb2dsZS5jb20vbWFjcm9zL3MvLzovcHR0aA==';
    var _URL_REVERSED = atob(_URL_ENCODED);
    var SCRIPT_URL = _URL_REVERSED.split('').reverse().join('');
    
    // ============================================================
    // ⚙️ KONFIGURASI APLIKASI
    // ============================================================
    
    var CONFIG = {
        DEFAULT_BATCH_COUNT: 5,
        DEFAULT_ROWS_PER_BATCH: 4,
        DEFAULT_PEMBELI: ['Pembeli 1', 'Pembeli 2', 'Pembeli 3', 'Pembeli 4', 'Pembeli 5'],
        DEFAULT_METODE: 'Non Kontan',
        SCROLL_DELAY: {
            ANDROID: 200,
            IOS: 350
        },
        SCROLL_OFFSET: 80,
        HIGHLIGHT_DURATION: 800,
        KEYBOARD_THRESHOLD: 100
    };
    
    // ============================================================
    // 📦 STATE APLIKASI
    // ============================================================
    
    var AppState = {
        masterData: {
            pembeli: [],
            ikan: [],
            bongkaran: [],
            rekap: [],
            metodePembayaran: []
        },
        batchItems: [],
        batchCounter: 0,
        dbConnected: false,
        isMobile: false,
        isIOS: false,
        lastFocusedElement: null,
        keyboardTimeout: null,
        lastWindowHeight: 0
    };
    
    // ============================================================
    // 🛠️ UTILITY FUNCTIONS
    // ============================================================
    
    var Utils = {
        formatRupiah: function(angka) {
            if (isNaN(angka)) angka = 0;
            return 'Rp ' + new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
            }).format(angka);
        },
        
        getHariFromDate: function(dateString) {
            if (!dateString) return '-';
            var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            var date = new Date(dateString);
            if (!isNaN(date.getTime())) return days[date.getDay()];
            return '-';
        },
        
        formatTanggalIndonesia: function(dateStr) {
            if (!dateStr) return '-';
            var parts = dateStr.split('-');
            if (parts.length === 3) {
                var bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                return parseInt(parts[2]) + ' ' + bulan[parseInt(parts[1]) - 1] + ' ' + parts[0];
            }
            return dateStr;
        },
        
        formatTanggalCetak: function(dateStr) {
            if (!dateStr) return '-';
            var parts = dateStr.split('-');
            if (parts.length === 3) {
                return parts[2] + '/' + parts[1] + '/' + parts[0].slice(-2);
            }
            return dateStr;
        },
        
        convertUTCtoWIB: function(utcDateString) {
            if (!utcDateString) return '';
            var date;
            if (utcDateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
                date = new Date(Date.UTC(
                    parseInt(utcDateString.split('-')[0]),
                    parseInt(utcDateString.split('-')[1]) - 1,
                    parseInt(utcDateString.split('-')[2]),
                    12, 0, 0
                ));
            } else {
                date = new Date(utcDateString);
            }
            if (isNaN(date.getTime())) return utcDateString;
            var wibDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
            return wibDate.getUTCFullYear() + '-' +
                String(wibDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
                String(wibDate.getUTCDate()).padStart(2, '0');
        },
        
        convertWIBtoUTC: function(wibDateString) {
            if (!wibDateString) return '';
            var parts = wibDateString.split('-');
            if (parts.length !== 3) return wibDateString;
            var utcDate = new Date(Date.UTC(
                parseInt(parts[0]),
                parseInt(parts[1]) - 1,
                parseInt(parts[2]),
                17, 0, 0
            ));
            return utcDate.getUTCFullYear() + '-' +
                String(utcDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
                String(utcDate.getUTCDate()).padStart(2, '0');
        },
        
        normalizeDateForDisplay: function(dateString) {
            return dateString ? Utils.convertUTCtoWIB(dateString) : '';
        },
        
        getBatch: function(batchId) {
            for (var i = 0; i < AppState.batchItems.length; i++) {
                if (AppState.batchItems[i].id === batchId) return AppState.batchItems[i];
            }
            return null;
        },
        
        isMobileDevice: function() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        },
        
        isIOSDevice: function() {
            return /iPad|iPhone|iPod/.test(navigator.userAgent);
        }
    };
    
    // ============================================================
    // 🔧 ENCODE URL HELPER (UNTUK UPDATE URL)
    // ============================================================
    
    // Cara pakai: buka console browser, jalankan:
    // encodeUrl('https://script.google.com/macros/s/ID/exec')
    window.encodeUrl = function(url) {
        var reversed = url.split('').reverse().join('');
        var encoded = btoa(reversed);
        console.log('URL Encoded:', encoded);
        console.log('Copy paste ke _URL_ENCODED');
        return encoded;
    };
    
    // ============================================================
    // 🎯 SELECT2 SETUP
    // ============================================================
    
    var Select2Setup = {
        startsWithSearch: function(selector, autoOpen) {
            $(selector).select2({
                theme: 'default',
                width: '100%',
                placeholder: 'Klik lalu ketik',
                allowClear: true,
                matcher: function(params, data) {
                    var term = $.trim(params.term);
                    if (term === '') return data;
                    var searchTerm = term.toLowerCase();
                    var text = data.text.toLowerCase();
                    if (text === searchTerm || text.indexOf(searchTerm + ' ') === 0 || text.indexOf(searchTerm) === 0) {
                        return data;
                    }
                    var words = text.split(/\s+/);
                    for (var i = 0; i < words.length; i++) {
                        if (words[i].indexOf(searchTerm) === 0) {
                            return data;
                        }
                    }
                    return null;
                }
            });
            if (autoOpen) {
                $(selector).on('select2:open', function() {
                    setTimeout(function() {
                        var searchField = document.querySelector('.select2-search__field');
                        if (searchField) {
                            searchField.focus();
                            searchField.select();
                        }
                    }, 50);
                });
            }
        },
        
        setupIkan: function(selector) {
            if ($(selector).data('select2')) {
                $(selector).select2('destroy');
            }
            $(selector).select2({
                theme: 'default',
                width: '100%',
                placeholder: 'Klik lalu ketik',
                allowClear: true,
                matcher: function(params, data) {
                    var term = $.trim(params.term);
                    if (term === '') return data;
                    var searchTerm = term.toLowerCase();
                    var text = data.text.toLowerCase();
                    if (text === searchTerm || text.indexOf(searchTerm + ' ') === 0 || text.indexOf(searchTerm) === 0) return data;
                    var words = text.split(/\s+/);
                    for (var i = 0; i < words.length; i++) {
                        if (words[i].indexOf(searchTerm) === 0) return data;
                    }
                    return null;
                }
            });
            $(selector).on('select2:open', function() {
                setTimeout(function() {
                    var searchField = document.querySelector('.select2-container--open .select2-search__field');
                    if (searchField) {
                        searchField.focus();
                        searchField.select();
                    }
                }, 50);
            });
        }
    };
    
    // ============================================================
    // 📦 BATCH MANAGEMENT
    // ============================================================
    
    var BatchManager = {
        updateTotal: function(batchId) {
            var batch = Utils.getBatch(batchId);
            if (!batch) return;
            var total = 0;
            for (var i = 0; i < batch.items.length; i++) {
                total += batch.items[i].subtotal || 0;
            }
            batch.total = total;
            $('#subtotal-' + batchId).text(Utils.formatRupiah(total));
        },
        
        updateSummary: function() {
            var totalTransaksi = AppState.batchItems.length;
            var totalItems = 0;
            var totalNominal = 0;
            for (var i = 0; i < AppState.batchItems.length; i++) {
                totalItems += AppState.batchItems[i].items.length;
                totalNominal += AppState.batchItems[i].total || 0;
            }
            $('#batchCount').text(totalTransaksi);
            $('#summaryTransaksi').text(totalTransaksi);
            $('#summaryItem').text(totalItems);
            $('#summaryTotal').text(Utils.formatRupiah(totalNominal));
            $('#totalBatch').text(Utils.formatRupiah(totalNominal));
            $('#batchItemCount').text(totalTransaksi + ' transaksi, ' + totalItems + ' item ikan');
        },
        
        clear: function() {
            AppState.batchItems = [];
            $('#batchContainer').empty();
            AppState.batchCounter = 0;
            BatchManager.updateSummary();
        },
        
        remove: function(batchId) {
            if (AppState.batchItems.length <= 1) {
                alert('Minimal 1 transaksi dalam batch!');
                return;
            }
            if (!confirm('Hapus transaksi ini?')) return;
            for (var i = 0; i < AppState.batchItems.length; i++) {
                if (AppState.batchItems[i].id === batchId) {
                    AppState.batchItems.splice(i, 1);
                    break;
                }
            }
            $('#' + batchId).remove();
            BatchManager.updateSummary();
        },
        
        renderItemHTML: function(item) {
            var html = '<div class="batch-item" id="' + item.id + '">';
            html += '<span class="batch-number">#' + (AppState.batchItems.indexOf(item) + 1) + '</span>';
            html += '<button type="button" class="btn btn-sm btn-danger btn-remove-batch" onclick="window.removeBatch(\'' + item.id + '\')"><i class="fas fa-times"></i></button>';
            
            // ROW PERTAMA: Pembeli, DP, Metode
            html += '<div class="row mb-2">';
            html += '<div class="col-md-5">';
            html += '<label class="form-label"><i class="fas fa-user"></i> Pembeli</label>';
            html += '<select class="form-select select-pembeli-batch" data-batch="' + item.id + '" style="width:100%;" id="pembeli-select-' + item.id + '">';
            html += '<option value="">Pilih pembeli</option>';
            if (AppState.masterData.pembeli && AppState.masterData.pembeli.length) {
                for (var i = 0; i < AppState.masterData.pembeli.length; i++) {
                    var selected = (AppState.masterData.pembeli[i] === item.pembeli) ? 'selected' : '';
                    html += '<option value="' + AppState.masterData.pembeli[i] + '" ' + selected + '>' + AppState.masterData.pembeli[i] + '</option>';
                }
            }
            html += '</select></div>';
            html += '<div class="col-md-3">';
            html += '<label class="form-label"><i class="fas fa-money-bill-alt"></i> DP</label>';
            html += '<input type="number" class="form-control input-dp-batch" data-batch="' + item.id + '" value="' + (item.dp || 0) + '" step="1000" placeholder="0">';
            html += '</div>';
            html += '<div class="col-md-4">';
            html += '<label class="form-label"><i class="fas fa-money-bill-wave"></i> Metode</label>';
            html += '<select class="form-select select-metode-batch" data-batch="' + item.id + '">';
            if (AppState.masterData.metodePembayaran && AppState.masterData.metodePembayaran.length) {
                for (var i = 0; i < AppState.masterData.metodePembayaran.length; i++) {
                    var selected = (AppState.masterData.metodePembayaran[i] === item.metode) ? 'selected' : '';
                    html += '<option value="' + AppState.masterData.metodePembayaran[i] + '" ' + selected + '>' + AppState.masterData.metodePembayaran[i] + '</option>';
                }
            }
            html += '</select></div></div>';
            
            // ROW KEDUA: Bongkaran
            html += '<div class="row mb-2">';
            html += '<div class="col-md-12">';
            html += '<label class="form-label"><i class="fas fa-boxes"></i> Bongkaran</label>';
            html += '<input type="text" class="form-control input-bongkaran-batch" data-batch="' + item.id + '" value="' + (item.bongkaran || $('#bongkaranBatchGlobal').val() || '') + '" placeholder="Nama bongkaran..." list="bongkaranListBatch">';
            html += '<div class="auto-fill-hint">💡 Isi otomatis dari master bongkaran</div>';
            html += '</div></div>';
            
            // TABLE ITEMS
            html += '<div class="table-container"><div class="table-responsive">';
            html += '<table class="table-ikan">';
            html += '<thead><tr>';
            html += '<th>Jenis Ikan</th>';
            html += '<th>Kg</th>';
            html += '<th>Harga</th>';
            html += '<th>Subtotal</th>';
            html += '<th>Aksi</th>';
            html += '</tr></thead>';
            html += '<tbody id="itemsBody-' + item.id + '">';
            
            for (var i = 0; i < item.items.length; i++) {
                var row = item.items[i];
                html += '<tr id="' + item.id + '-item-' + i + '">';
                html += '<td><select class="form-select select-ikan-batch" data-batch="' + item.id + '" data-row="' + i + '" style="width:100%;">';
                html += '<option value="">Pilih</option>';
                if (AppState.masterData.ikan && AppState.masterData.ikan.length) {
                    for (var j = 0; j < AppState.masterData.ikan.length; j++) {
                        var ikan = AppState.masterData.ikan[j];
                        var namaIkan = typeof ikan === 'object' ? (ikan.nama || ikan) : ikan;
                        var hargaDefault = typeof ikan === 'object' ? (ikan.hargaDefault || ikan.harga || 0) : 0;
                        var selected = (namaIkan === row.jenis) ? 'selected' : '';
                        html += '<option value="' + namaIkan + '" data-harga="' + hargaDefault + '" ' + selected + '>' + namaIkan + '</option>';
                    }
                }
                html += '</select></td>';
                html += '<td><input type="number" step="0.001" class="form-control text-end input-jumlah-batch" data-batch="' + item.id + '" data-row="' + i + '" value="' + (row.jumlah || '') + '" placeholder="0"></td>';
                html += '<td><input type="number" class="form-control text-end input-harga-batch" data-batch="' + item.id + '" data-row="' + i + '" value="' + (row.harga || '') + '" placeholder="0"></td>';
                html += '<td><input type="text" class="form-control text-end input-subtotal-batch" data-batch="' + item.id + '" data-row="' + i + '" readonly style="background:#e9ecef; font-weight:600; color:#2c7da0;" value="' + Utils.formatRupiah(row.subtotal || 0) + '"></td>';
                html += '<td class="text-center"><button type="button" class="btn btn-danger btn-sm btn-remove-item-batch" data-batch="' + item.id + '" data-row="' + i + '"><i class="fas fa-trash-alt"></i></button></td>';
                html += '</tr>';
            }
            
            html += '</tbody></table></div></div>';
            html += '<button type="button" class="btn-add-row" onclick="window.addItemToBatch(\'' + item.id + '\')"><i class="fas fa-plus me-2"></i> Tambah Ikan</button>';
            html += '<div class="text-end mt-2"><strong>Subtotal Transaksi: <span id="subtotal-' + item.id + '" style="color:#2c7da0;font-size:18px;">' + Utils.formatRupiah(item.total) + '</span></strong></div>';
            html += '</div>';
            return html;
        },
        
        setupEvents: function(batchId) {
            Select2Setup.startsWithSearch('.select-pembeli-batch[data-batch="' + batchId + '"]', true);
            $('.select-ikan-batch[data-batch="' + batchId + '"]').each(function() {
                Select2Setup.setupIkan(this);
            });
        },
        
        render: function(item) {
            var container = $('#batchContainer');
            var itemCounter = item.itemCounter || 0;
            if (itemCounter === 0) {
                item.items = [];
                for (var i = 0; i < CONFIG.DEFAULT_ROWS_PER_BATCH; i++) {
                    item.items.push({ jenis: '', jumlah: 0, harga: 0, subtotal: 0 });
                    itemCounter++;
                }
                item.itemCounter = itemCounter;
            }
            var html = BatchManager.renderItemHTML(item);
            container.append(html);
            BatchManager.setupEvents(item.id);
            EventManager.reattachGlobal();
        },
        
        add: function(pembeli, bongkaran, dp, metode) {
            AppState.batchCounter++;
            var batchId = 'batch-' + AppState.batchCounter;
            var item = {
                id: batchId,
                pembeli: pembeli || '',
                bongkaran: bongkaran || $('#bongkaranBatchGlobal').val() || '',
                dp: dp || 0,
                metode: metode || CONFIG.DEFAULT_METODE,
                items: [],
                total: 0,
                itemCounter: 0
            };
            AppState.batchItems.push(item);
            BatchManager.render(item);
            BatchManager.updateSummary();
            return item;
        },
        
        calculateItemSubtotal: function(batchId, row) {
            var batch = Utils.getBatch(batchId);
            if (!batch) return;
            if (!batch.items || !batch.items[row]) return;
            
            var batchElement = $('#' + batchId);
            if (!batchElement.length) return;
            
            var jumlahInput = batchElement.find('.input-jumlah-batch[data-batch="' + batchId + '"][data-row="' + row + '"]');
            var hargaInput = batchElement.find('.input-harga-batch[data-batch="' + batchId + '"][data-row="' + row + '"]');
            var subtotalInput = batchElement.find('.input-subtotal-batch[data-batch="' + batchId + '"][data-row="' + row + '"]');
            
            if (!jumlahInput.length) {
                jumlahInput = batchElement.find('.input-jumlah-batch[data-row="' + row + '"]');
            }
            if (!hargaInput.length) {
                hargaInput = batchElement.find('.input-harga-batch[data-row="' + row + '"]');
            }
            if (!subtotalInput.length) {
                subtotalInput = batchElement.find('.input-subtotal-batch[data-row="' + row + '"]');
            }
            
            if (!jumlahInput.length || !hargaInput.length || !subtotalInput.length) return;
            
            var jumlah = parseFloat(jumlahInput.val()) || 0;
            var harga = parseFloat(hargaInput.val()) || 0;
            var subtotal = jumlah * harga;
            
            batch.items[row].jumlah = jumlah;
            batch.items[row].harga = harga;
            batch.items[row].subtotal = subtotal;
            
            subtotalInput.val(Utils.formatRupiah(subtotal));
            
            BatchManager.updateTotal(batchId);
            BatchManager.updateSummary();
        },
        
        addItem: function(batchId) {
            var batch = Utils.getBatch(batchId);
            if (!batch) return;
            batch.items.push({ jenis: '', jumlah: 0, harga: 0, subtotal: 0 });
            batch.itemCounter = batch.items.length;
            var batchElement = $('#' + batchId);
            batchElement.replaceWith(BatchManager.renderItemHTML(batch));
            BatchManager.setupEvents(batchId);
            EventManager.reattachGlobal();
            BatchManager.updateSummary();
            var newRow = batch.items.length - 1;
            var selectIkan = $('.select-ikan-batch[data-batch="' + batchId + '"][data-row="' + newRow + '"]');
            if (selectIkan.length) {
                setTimeout(function() {
                    selectIkan.select2('open');
                    setTimeout(function() {
                        var searchField = document.querySelector('.select2-container--open .select2-search__field');
                        if (searchField) {
                            searchField.focus();
                            searchField.select();
                        }
                    }, 100);
                }, 200);
            }
        },
        
        removeItem: function(batchId, row) {
            var batch = Utils.getBatch(batchId);
            if (!batch) return;
            if (batch.items.length <= 1) {
                alert('Minimal 1 item ikan per transaksi!');
                return;
            }
            batch.items.splice(row, 1);
            batch.itemCounter = batch.items.length;
            var batchElement = $('#' + batchId);
            batchElement.replaceWith(BatchManager.renderItemHTML(batch));
            BatchManager.setupEvents(batchId);
            EventManager.reattachGlobal();
            BatchManager.updateSummary();
            var focusRow = Math.min(row, batch.items.length - 1);
            var focusInput = $('.input-jumlah-batch[data-batch="' + batchId + '"][data-row="' + focusRow + '"]');
            if (focusInput.length) {
                setTimeout(function() {
                    focusInput.focus();
                }, 150);
            }
        }
    };
    
    // ============================================================
    // 🎯 EVENT MANAGER
    // ============================================================
    
    var EventManager = {
        reattachGlobal: function() {
            $(document).off('input', '.input-jumlah-batch');
            $(document).off('input', '.input-harga-batch');
            $(document).off('change', '.select-ikan-batch');
            $(document).off('change', '.input-bongkaran-batch');
            $(document).off('change', '.input-dp-batch');
            $(document).off('change', '.select-metode-batch');
            $(document).off('change', '.select-pembeli-batch');
            $(document).off('click', '.btn-remove-item-batch');
            
            $(document).on('input', '.input-jumlah-batch', function() {
                var bId = $(this).closest('.batch-item').attr('id');
                var row = $(this).data('row');
                if (bId && row !== undefined) {
                    BatchManager.calculateItemSubtotal(bId, row);
                }
            });
            
            $(document).on('input', '.input-harga-batch', function() {
                var bId = $(this).closest('.batch-item').attr('id');
                var row = $(this).data('row');
                if (bId && row !== undefined) {
                    BatchManager.calculateItemSubtotal(bId, row);
                }
            });
            
            $(document).on('change', '.select-ikan-batch', function() {
                var bId = $(this).closest('.batch-item').attr('id');
                var row = $(this).data('row');
                var hargaDefault = $(this).find('option:selected').data('harga') || 0;
                var batch = Utils.getBatch(bId);
                if (batch && batch.items[row]) {
                    batch.items[row].jenis = $(this).val();
                    batch.items[row].harga = hargaDefault;
                    var hargaInput = $('.input-harga-batch[data-batch="' + bId + '"][data-row="' + row + '"]');
                    if (hargaInput.length) {
                        hargaInput.val(hargaDefault);
                    }
                    BatchManager.calculateItemSubtotal(bId, row);
                }
            });
            
            $(document).on('change', '.input-bongkaran-batch', function() {
                var bId = $(this).closest('.batch-item').attr('id');
                var batch = Utils.getBatch(bId);
                if (batch) batch.bongkaran = $(this).val();
            });
            
            $(document).on('change', '#bongkaranBatchGlobal', function() {
                var val = $(this).val();
                $('.input-bongkaran-batch').val(val);
                for (var i = 0; i < AppState.batchItems.length; i++) {
                    AppState.batchItems[i].bongkaran = val;
                }
            });
            
            $(document).on('change', '.input-dp-batch', function() {
                var bId = $(this).closest('.batch-item').attr('id');
                var batch = Utils.getBatch(bId);
                if (batch) batch.dp = parseFloat($(this).val()) || 0;
            });
            
            $(document).on('change', '.select-metode-batch', function() {
                var bId = $(this).closest('.batch-item').attr('id');
                var batch = Utils.getBatch(bId);
                if (batch) batch.metode = $(this).val();
            });
            
            $(document).on('change', '.select-pembeli-batch', function() {
                var bId = $(this).closest('.batch-item').attr('id');
                var batch = Utils.getBatch(bId);
                if (batch) batch.pembeli = $(this).val();
            });
            
            $(document).on('click', '.btn-remove-item-batch', function() {
                var bId = $(this).closest('.batch-item').attr('id');
                var row = $(this).data('row');
                BatchManager.removeItem(bId, row);
            });
            
            $('.input-jumlah-batch, .input-harga-batch').off('focus blur').on('focus', function() {
                if (this.value === '0' || this.value === '') {
                    this.value = '';
                }
            }).on('blur', function() {
                if (this.value === '' || this.value === '0') {
                    this.value = '0';
                    var bId = $(this).closest('.batch-item').attr('id');
                    var row = $(this).data('row');
                    if (bId && row !== undefined) {
                        BatchManager.calculateItemSubtotal(bId, row);
                    }
                }
            });
        }
    };
    
    // ============================================================
    // 📱 SCROLL OTOMATIS UNTUK HP (CLEAN VERSION)
    // ============================================================
    
    var ScrollManager = {
        init: function() {
            // Deteksi device
            AppState.isMobile = Utils.isMobileDevice();
            AppState.isIOS = Utils.isIOSDevice();
            
            if (!AppState.isMobile) return;
            
            console.log('📱 Mode Mobile aktif - Scroll otomatis diaktifkan');
            
            this.bindEvents();
        },
        
        scrollToElement: function(element) {
            if (!element) return;
            
            var delay = AppState.isIOS ? CONFIG.SCROLL_DELAY.IOS : CONFIG.SCROLL_DELAY.ANDROID;
            
            clearTimeout(AppState.keyboardTimeout);
            AppState.keyboardTimeout = setTimeout(function() {
                try {
                    var rect = element.getBoundingClientRect();
                    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    
                    // Posisi target dengan offset
                    var targetY = rect.top + scrollTop - CONFIG.SCROLL_OFFSET;
                    
                    // Scroll smooth
                    window.scrollTo({
                        top: targetY,
                        behavior: 'smooth'
                    });
                    
                    // Highlight effect
                    ScrollManager.highlightElement(element);
                    
                } catch(e) {
                    // Silent error
                }
            }, delay);
        },
        
        highlightElement: function(element) {
            try {
                element.style.transition = 'background-color 0.3s ease';
                element.style.backgroundColor = '#e8f4fd';
                setTimeout(function() {
                    element.style.backgroundColor = '';
                }, CONFIG.HIGHLIGHT_DURATION);
            } catch(e) {
                // Silent error
            }
        },
        
        bindEvents: function() {
            var self = this;
            
            // ===== FOCUS EVENT =====
            document.addEventListener('focusin', function(event) {
                var target = event.target;
                AppState.lastFocusedElement = target;
                
                if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                    // Skip date/time picker
                    if (target.type === 'date' || target.type === 'time') {
                        return;
                    }
                    
                    var batchItem = target.closest('.batch-item');
                    if (batchItem) {
                        self.scrollToElement(batchItem);
                    } else {
                        self.scrollToElement(target);
                    }
                }
            });
            
            // ===== SELECT2 OPEN =====
            $(document).on('select2:open', function(e) {
                var target = e.target;
                var select2Container = $(target).closest('.select2-container');
                if (select2Container.length) {
                    var batchItem = select2Container.closest('.batch-item');
                    if (batchItem.length) {
                        self.scrollToElement(batchItem[0]);
                    } else {
                        self.scrollToElement(select2Container[0]);
                    }
                }
            });
            
            // ===== INPUT CHANGE =====
            document.addEventListener('input', function(event) {
                var target = event.target;
                if (target.tagName === 'INPUT') {
                    var batchItem = target.closest('.batch-item');
                    if (batchItem && (target.classList.contains('input-jumlah-batch') || target.classList.contains('input-harga-batch'))) {
                        self.scrollToElement(batchItem);
                    }
                }
            });
            
            // ===== TOMBOL TAMBAH IKAN =====
            $(document).on('click', '.btn-add-row', function() {
                var batchItem = $(this).closest('.batch-item');
                if (batchItem.length) {
                    setTimeout(function() {
                        self.scrollToElement(batchItem[0]);
                    }, 300);
                }
            });
            
            // ===== TOMBOL TAMBAH BATCH =====
            $('#btnTambahBatch').on('click', function() {
                setTimeout(function() {
                    var lastBatch = $('#batchContainer .batch-item:last-child');
                    if (lastBatch.length) {
                        self.scrollToElement(lastBatch[0]);
                    }
                }, 400);
            });
            
            // ===== RESIZE (KEYBOARD) =====
            AppState.lastWindowHeight = window.innerHeight;
            window.addEventListener('resize', function() {
                var currentHeight = window.innerHeight;
                var diff = AppState.lastWindowHeight - currentHeight;
                
                if (diff > CONFIG.KEYBOARD_THRESHOLD) {
                    // Keyboard muncul
                    if (AppState.lastFocusedElement) {
                        setTimeout(function() {
                            var batchItem = AppState.lastFocusedElement.closest('.batch-item');
                            if (batchItem) {
                                self.scrollToElement(batchItem);
                            } else {
                                self.scrollToElement(AppState.lastFocusedElement);
                            }
                        }, 300);
                    }
                }
                
                AppState.lastWindowHeight = currentHeight;
            });
            
            // ===== INITIAL SCROLL =====
            setTimeout(function() {
                var activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
                    var batchItem = activeElement.closest('.batch-item');
                    if (batchItem) {
                        self.scrollToElement(batchItem);
                    } else {
                        self.scrollToElement(activeElement);
                    }
                }
            }, 500);
            
            console.log('✅ Scroll otomatis untuk HP aktif!');
        }
    };
    
    // ============================================================
    // 💾 API & DATA MANAGEMENT
    // ============================================================
    
    var DataManager = {
        saveBatch: async function() {
            if (!AppState.dbConnected) { alert('Database belum siap.'); return; }
            if (AppState.batchItems.length === 0) { alert('Tidak ada transaksi untuk disimpan!'); return; }
            
            var tanggalWIB = $('#tanggal').val();
            if (!tanggalWIB) { alert('Pilih tanggal transaksi!'); return; }
            
            var hari = Utils.getHariFromDate(tanggalWIB);
            var tanggalUTC = Utils.convertWIBtoUTC(tanggalWIB);
            var bongkaranGlobal = $('#bongkaranBatchGlobal').val() || '';
            
            // Validasi
            var valid = true;
            for (var i = 0; i < AppState.batchItems.length; i++) {
                var batch = AppState.batchItems[i];
                if (!batch.pembeli) { alert('Transaksi #' + (i+1) + ': Pembeli belum dipilih!'); valid = false; break; }
                if (!batch.metode) { alert('Transaksi #' + (i+1) + ': Metode pembayaran belum dipilih!'); valid = false; break; }
                
                var hasItem = false;
                for (var j = 0; j < batch.items.length; j++) {
                    if (batch.items[j].jenis && batch.items[j].jumlah > 0 && batch.items[j].harga > 0) {
                        hasItem = true;
                        break;
                    }
                }
                if (!hasItem) { alert('Transaksi #' + (i+1) + ': Minimal satu item ikan!'); valid = false; break; }
                if (batch.dp > batch.total) { alert('Transaksi #' + (i+1) + ': DP tidak boleh lebih besar dari total!'); valid = false; break; }
            }
            if (!valid) return;
            
            var btnSimpan = $('#btnSimpanBatch');
            btnSimpan.prop('disabled', true).html('<div class="loading-spinner"></div> Menyimpan ' + AppState.batchItems.length + ' transaksi...');
            
            var allSuccess = true;
            var errorMsg = '';
            var totalSaved = 0;
            
            for (var i = 0; i < AppState.batchItems.length; i++) {
                var batch = AppState.batchItems[i];
                var dpValue = batch.dp || 0;
                var bongkaranValue = batch.bongkaran || bongkaranGlobal || '-';
                
                for (var j = 0; j < batch.items.length; j++) {
                    var item = batch.items[j];
                    if (!item.jenis || item.jumlah <= 0 || item.harga <= 0) continue;
                    
                    var dpForItem = (j === 0) ? dpValue : 0;
                    try {
                        await fetch(SCRIPT_URL, {
                            method: "POST",
                            mode: "no-cors",
                            headers: {"Content-Type": "application/json"},
                            body: JSON.stringify({
                                tanggal: tanggalUTC,
                                hari: hari,
                                pembeli: batch.pembeli,
                                jenisIkan: item.jenis,
                                jumlah: item.jumlah,
                                harga: item.harga,
                                total: item.subtotal,
                                dp: dpForItem,
                                bongkaran: bongkaranValue,
                                metodePembayaran: batch.metode
                            })
                        });
                        totalSaved++;
                    } catch(err) {
                        allSuccess = false;
                        errorMsg = err.message;
                        break;
                    }
                }
                if (!allSuccess) break;
            }
            
            btnSimpan.prop('disabled', false).html('<i class="fas fa-save me-2"></i> Simpan Semua Transaksi');
            
            if (allSuccess) {
                alert('✓ ' + totalSaved + ' item berhasil disimpan dari ' + AppState.batchItems.length + ' transaksi!');
                await DataManager.loadAll();
                BatchManager.clear();
                for (var i = 0; i < CONFIG.DEFAULT_BATCH_COUNT; i++) {
                    var pembeli = (i < CONFIG.DEFAULT_PEMBELI.length) ? CONFIG.DEFAULT_PEMBELI[i] : '';
                    BatchManager.add(pembeli, bongkaranGlobal, 0, $('#metodePembayaranBatch').val() || CONFIG.DEFAULT_METODE);
                }
                BatchManager.updateSummary();
                $('#tanggal').val(tanggalWIB).trigger('change');
                $('#tanggalInfo').html("📅 Menggunakan tanggal transaksi terakhir: " + Utils.formatTanggalIndonesia(tanggalWIB));
            } else {
                alert('⚠️ Gagal menyimpan: ' + errorMsg);
            }
        },
        
        loadAll: async function() {
            try {
                $('#connectionStatus').removeClass('error success').addClass('success')
                    .html('<div class="loading-spinner"></div> Menghubungkan ke database...').show();
                
                var response = await fetch(SCRIPT_URL);
                var result = await response.json();
                
                if (result.status === 'success') {
                    AppState.masterData.pembeli = result.pembeli || [];
                    AppState.masterData.ikan = result.ikan || [];
                    AppState.masterData.bongkaran = result.bongkaran || [];
                    AppState.masterData.metodePembayaran = result.metodePembayaran || ['Non Kontan', 'Kontan', 'Transfer', 'Tempo'];
                    
                    AppState.masterData.rekap = (result.rekap || []).map(function(item) {
                        var newItem = Object.assign({}, item);
                        if (newItem.tanggal) {
                            newItem.tanggal_utc = newItem.tanggal;
                            newItem.tanggal = Utils.normalizeDateForDisplay(newItem.tanggal);
                            newItem.hari = Utils.getHariFromDate(newItem.tanggal);
                        }
                        if (!newItem.bongkaran) newItem.bongkaran = '';
                        if (!newItem.metodePembayaran) newItem.metodePembayaran = 'Non Kontan';
                        if (newItem.dp === undefined) newItem.dp = 0;
                        return newItem;
                    });
                    
                    AppState.masterData.rekap.sort(function(a, b) {
                        return a.tanggal > b.tanggal ? -1 : a.tanggal < b.tanggal ? 1 : 0;
                    });
                    
                    // Set default date
                    var today = new Date();
                    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                    var defaultDate = todayStr;
                    var infoText = "📅 Menggunakan tanggal hari ini (belum ada transaksi)";
                    
                    if (AppState.masterData.rekap.length > 0) {
                        var lastTransactionDate = AppState.masterData.rekap[0].tanggal;
                        if (lastTransactionDate) {
                            defaultDate = lastTransactionDate;
                            infoText = "📅 Menggunakan tanggal transaksi terakhir: " + Utils.formatTanggalIndonesia(lastTransactionDate);
                        }
                    }
                    
                    $('#tanggal').val(defaultDate).trigger('change');
                    $('#tanggalInfo').html(infoText);
                    
                    $('#debugInfo').html("✅ Data berhasil dimuat. Ikan: " + AppState.masterData.ikan.length + 
                        ", Pembeli: " + AppState.masterData.pembeli.length + 
                        ", Bongkaran: " + AppState.masterData.bongkaran.length + 
                        ", Transaksi: " + AppState.masterData.rekap.length);
                    
                    // Update metode
                    var metodeSelect = $('#metodePembayaranBatch');
                    metodeSelect.empty();
                    if (AppState.masterData.metodePembayaran && AppState.masterData.metodePembayaran.length) {
                        for (var i = 0; i < AppState.masterData.metodePembayaran.length; i++) {
                            metodeSelect.append('<option value="' + AppState.masterData.metodePembayaran[i] + '">' + AppState.masterData.metodePembayaran[i] + '</option>');
                        }
                    }
                    metodeSelect.val('Non Kontan');
                    
                    // Update filters
                    UIManager.updateFilterPembeli();
                    UIManager.updateFilterMetodePembayaran();
                    UIManager.updateFilterBongkaran();
                    UIManager.updateFilterMetodeBayarBongkaran();
                    UIManager.updateBongkaranDatalist();
                    
                    // Init batch items
                    if (AppState.batchItems.length === 0) {
                        for (var i = 0; i < CONFIG.DEFAULT_BATCH_COUNT; i++) {
                            var pembeli = (i < CONFIG.DEFAULT_PEMBELI.length) ? CONFIG.DEFAULT_PEMBELI[i] : '';
                            BatchManager.add(pembeli, '', 0, 'Non Kontan');
                        }
                        BatchManager.updateSummary();
                    }
                    
                    UIManager.refreshMasterDisplay();
                    
                    $('#connectionStatus').html('<i class="fas fa-check-circle me-2"></i> Database terhubung!')
                        .fadeIn().delay(2000).fadeOut();
                    
                    AppState.dbConnected = true;
                    
                    $('#filterTglMulai').val(todayStr);
                    $('#filterTglSelesai').val(todayStr);
                    $('#bongkaranTanggalSelect').val(todayStr);
                    
                    UIManager.filterData();
                    UIManager.tampilkanRekapBongkaran();
                    
                } else {
                    throw new Error(result.message || 'Gagal mengambil data');
                }
            } catch(err) {
                $('#connectionStatus').removeClass('success').addClass('error')
                    .html('<i class="fas fa-exclamation-triangle me-2"></i> Gagal koneksi: ' + err.message).show();
                $('#debugInfo').html("❌ Error: " + err.message + "<br><br>🔗 Pastikan URL Web App sudah benar");
                AppState.dbConnected = false;
            }
        }
    };
    
    // ============================================================
    // 🎨 UI MANAGER
    // ============================================================
    
    var UIManager = {
        updateFilterPembeli: function() {
            var filter = $('#filterPembeli');
            filter.empty().append('<option value="all">Semua Pembeli</option>');
            if (AppState.masterData.pembeli && AppState.masterData.pembeli.length) {
                for (var i = 0; i < AppState.masterData.pembeli.length; i++) {
                    filter.append('<option value="' + AppState.masterData.pembeli[i] + '">' + AppState.masterData.pembeli[i] + '</option>');
                }
            }
            filter.select2({
                theme: 'default',
                width: '100%',
                placeholder: 'Klik lalu ketik nama pembeli',
                allowClear: true
            });
        },
        
        updateFilterMetodePembayaran: function() {
            var filter = $('#filterMetodePembayaran');
            filter.empty().append('<option value="all">Semua Metode</option>');
            if (AppState.masterData.metodePembayaran && AppState.masterData.metodePembayaran.length) {
                for (var i = 0; i < AppState.masterData.metodePembayaran.length; i++) {
                    filter.append('<option value="' + AppState.masterData.metodePembayaran[i] + '">' + AppState.masterData.metodePembayaran[i] + '</option>');
                }
            }
        },
        
        updateFilterMetodeBayarBongkaran: function() {
            var filter = $('#filterMetodeBayarBongkaran');
            filter.empty().append('<option value="all">Semua Metode</option>');
            if (AppState.masterData.metodePembayaran && AppState.masterData.metodePembayaran.length) {
                for (var i = 0; i < AppState.masterData.metodePembayaran.length; i++) {
                    filter.append('<option value="' + AppState.masterData.metodePembayaran[i] + '">' + AppState.masterData.metodePembayaran[i] + '</option>');
                }
            }
        },
        
        updateFilterBongkaran: function() {
            var filter = $('#filterBongkaran');
            filter.empty().append('<option value="all">Semua Bongkaran</option>');
            if (AppState.masterData.bongkaran && AppState.masterData.bongkaran.length) {
                var unique = [];
                for (var i = 0; i < AppState.masterData.bongkaran.length; i++) {
                    var b = AppState.masterData.bongkaran[i];
                    if (b && b.trim() && unique.indexOf(b) === -1) {
                        unique.push(b);
                    }
                }
                for (var i = 0; i < unique.length; i++) {
                    filter.append('<option value="' + unique[i].replace(/"/g, '&quot;') + '">📦 ' + unique[i] + '</option>');
                }
            }
        },
        
        updateBongkaranDatalist: function() {
            var datalistGlobal = $('#bongkaranListGlobal');
            if (datalistGlobal.length === 0) {
                $('body').append('<datalist id="bongkaranListGlobal"></datalist>');
                datalistGlobal = $('#bongkaranListGlobal');
            }
            datalistGlobal.empty();
            
            var datalistBatch = $('#bongkaranListBatch');
            if (datalistBatch.length === 0) {
                $('body').append('<datalist id="bongkaranListBatch"></datalist>');
                datalistBatch = $('#bongkaranListBatch');
            }
            datalistBatch.empty();
            
            if (AppState.masterData.bongkaran && AppState.masterData.bongkaran.length) {
                var unique = [];
                for (var i = 0; i < AppState.masterData.bongkaran.length; i++) {
                    var b = AppState.masterData.bongkaran[i];
                    if (b && b.trim() && unique.indexOf(b) === -1) {
                        unique.push(b);
                    }
                }
                for (var i = 0; i < unique.length; i++) {
                    datalistGlobal.append('<option value="' + unique[i] + '">');
                    datalistBatch.append('<option value="' + unique[i] + '">');
                }
            }
        },
        
        filterData: function() {
            var filtered = AppState.masterData.rekap.slice();
            var tglMulai = $('#filterTglMulai').val();
            var tglSelesai = $('#filterTglSelesai').val();
            var pembeli = $('#filterPembeli').val();
            var metode = $('#filterMetodePembayaran').val();
            
            if (tglMulai) filtered = filtered.filter(function(i) { return i.tanggal >= tglMulai; });
            if (tglSelesai) filtered = filtered.filter(function(i) { return i.tanggal <= tglSelesai; });
            if (pembeli && pembeli !== 'all') filtered = filtered.filter(function(i) { return i.pembeli === pembeli; });
            if (metode && metode !== 'all') filtered = filtered.filter(function(i) { return i.metodePembayaran === metode; });
            
            UIManager.displayRekapTable(filtered);
        },
        
        displayRekapTable: function(data) {
            var container = $('#rekapTableContainer');
            if (!data.length) {
                container.html('<div class="alert alert-info">Tidak ada data</div>');
                return;
            }
            
            var html = '<div class="rekap-table-container"><table class="rekap-table"><thead><tr>' +
                '<th>No</th><th>Hari</th><th>Tanggal</th><th>Pembeli</th><th>Jenis Ikan</th>' +
                '<th>Jumlah (kg)</th><th>Harga (Rp)</th><th>Total (Rp)</th></tr></thead><tbody>';
            
            for (var i = 0; i < data.length; i++) {
                var item = data[i];
                html += '<tr><td class="text-center">' + (i + 1) + '</td>' +
                    '<td class="text-center">' + item.hari + '</td>' +
                    '<td class="text-center">' + Utils.formatTanggalIndonesia(item.tanggal) + '</td>' +
                    '<td class="text-center">' + item.pembeli + '</td>' +
                    '<td>' + item.jenisIkan + '</td>' +
                    '<td class="text-end">' + parseFloat(item.jumlah).toLocaleString('id-ID') + '</td>' +
                    '<td class="text-end">' + Utils.formatRupiah(item.harga) + '</td>' +
                    '<td class="text-end fw-bold text-primary">' + Utils.formatRupiah(item.total) + '</td></tr>';
            }
            
            var grandTotal = 0;
            for (var i = 0; i < data.length; i++) grandTotal += (data[i].total || 0);
            
            html += '<tr class="grand-total-row"><td colspan="7" class="text-end fw-bold">GRAND TOTAL:</td>' +
                '<td class="text-end fw-bold text-success">' + Utils.formatRupiah(grandTotal) + '</td></tr></tbody></table></div>';
            
            container.html(html);
        },
        
        tampilkanRekapBongkaran: function() {
            var tanggal = $('#bongkaranTanggalSelect').val();
            var bongkaranFilter = $('#filterBongkaran').val();
            var metodeFilter = $('#filterMetodeBayarBongkaran').val();
            
            if (!tanggal) {
                $('#bongkaranTableContainer').html('<div class="alert alert-warning">Silakan pilih tanggal</div>');
                return;
            }
            
            var filtered = AppState.masterData.rekap.filter(function(item) {
                return item.tanggal === tanggal;
            });
            
            if (bongkaranFilter && bongkaranFilter !== 'all') {
                filtered = filtered.filter(function(item) { return item.bongkaran === bongkaranFilter; });
            }
            if (metodeFilter && metodeFilter !== 'all') {
                filtered = filtered.filter(function(item) { return item.metodePembayaran === metodeFilter; });
            }
            
            if (!filtered.length) {
                $('#bongkaranTableContainer').html('<div class="alert alert-info">Tidak ada data untuk tanggal ' + Utils.formatTanggalIndonesia(tanggal) + '</div>');
                return;
            }
            
            var grouped = {};
            for (var i = 0; i < filtered.length; i++) {
                var item = filtered[i];
                var b = item.bongkaran || 'Tanpa Bongkaran';
                if (!grouped[b]) grouped[b] = [];
                grouped[b].push(item);
            }
            
            var tglFormatted = Utils.formatTanggalIndonesia(tanggal);
            var hari = Utils.getHariFromDate(tanggal);
            var html = '<div class="alert alert-info mb-3"><i class="fas fa-calendar-alt me-2"></i> <strong>Tanggal Rekap: ' + tglFormatted + ' (' + hari + ')</strong></div>';
            var grandTotal = 0;
            
            for (var bongkaran in grouped) {
                var items = grouped[bongkaran];
                var summary = {};
                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    summary[item.jenisIkan] = (summary[item.jenisIkan] || 0) + parseFloat(item.jumlah);
                }
                
                var sorted = Object.entries(summary).sort(function(a, b) { return a[0].localeCompare(b[0]); });
                var totalKg = 0;
                var metode = items[0].metodePembayaran || '-';
                
                html += '<div class="card mb-4"><div class="bongkaran-header"><h5><i class="fas fa-box me-2"></i> ' + bongkaran + '</h5><span>' + tglFormatted + '</span></div>' +
                    '<div class="card-body p-0"><table class="rekap-ikan-table"><thead><tr><th>No</th><th>Jenis Ikan</th><th class="text-end">Jumlah (kg)</th><th>Metode Bayar</th></tr></thead><tbody>';
                
                var counter = 1;
                for (var i = 0; i < sorted.length; i++) {
                    var ikan = sorted[i][0];
                    var kg = sorted[i][1];
                    totalKg += kg;
                    html += '<tr><td class="text-center">' + counter++ + '</td><td>' + ikan + '</td><td class="text-end fw-bold">' + kg.toLocaleString('id-ID') + '</td>' +
                        '<td class="text-center"><span class="badge-metode">' + metode + '</span></td></tr>';
                }
                
                html += '<tr class="sub-bongkaran-total"><td colspan="2" class="text-end fw-bold">TOTAL ' + bongkaran + '</td>' +
                    '<td class="text-end fw-bold">' + totalKg.toLocaleString('id-ID') + '</td><td>-</td></tr>' +
                    '</tbody></table></div></div>';
                grandTotal += totalKg;
            }
            
            html += '<div class="total-box mt-3"><h4>GRAND TOTAL</h4><p>Tanggal: ' + tglFormatted + ' (' + hari + ') | Total Kg: <strong>' + grandTotal.toLocaleString('id-ID') + ' kg</strong></p></div>';
            $('#bongkaranTableContainer').html(html);
        },
        
        cetakRekapBongkaran: function() {
            alert('Fungsi cetak rekap bongkaran siap digunakan');
        },
        
        displayPembeliList: function() {
            var tbody = $('#listPembeli');
            tbody.empty();
            if (AppState.masterData.pembeli && AppState.masterData.pembeli.length) {
                for (var i = 0; i < AppState.masterData.pembeli.length; i++) {
                    tbody.append('<tr><td class="text-center">' + (i + 1) + '</td><td>' + AppState.masterData.pembeli[i] + '</td></tr>');
                }
            } else {
                tbody.append('<tr><td colspan="2" class="text-center">Belum ada data</td></tr>');
            }
            $('#pembeliCount').text('Total: ' + AppState.masterData.pembeli.length + ' pembeli');
        },
        
        displayIkanList: function(filterText) {
            filterText = filterText || '';
            var tbody = $('#listIkan');
            tbody.empty();
            var dataToShow = AppState.masterData.ikan.slice();
            
            if (filterText.trim() !== '') {
                var lowerFilter = filterText.toLowerCase();
                dataToShow = dataToShow.filter(function(item) {
                    var nama = typeof item === 'object' ? (item.nama || item) : item;
                    return nama.toLowerCase().indexOf(lowerFilter) !== -1;
                });
            }
            
            if (dataToShow.length) {
                for (var i = 0; i < dataToShow.length; i++) {
                    var item = dataToShow[i];
                    var nama = typeof item === 'object' ? (item.nama || item) : item;
                    var harga = typeof item === 'object' ? (item.hargaDefault || item.harga || 0) : 0;
                    tbody.append('<tr><td class="text-center">' + (i + 1) + '</td><td>' + nama + '</td>' +
                        '<td><input type="number" class="form-control form-control-sm harga-edit" data-ikan="' + nama + '" value="' + harga + '" step="500" style="width:150px;display:inline-block">' +
                        '<button class="btn btn-sm btn-primary btn-update-harga" data-ikan="' + nama + '"><i class="fas fa-save"></i></button></td>' +
                        '<td class="text-center"><button class="btn btn-sm btn-danger btn-delete-ikan" data-ikan="' + nama + '"><i class="fas fa-trash"></i></button></td></tr>');
                }
            } else {
                tbody.append('<tr><td colspan="4" class="text-center text-muted">Tidak ada data ikan yang ditemukan untuk "' + filterText + '"</td></tr>');
            }
            
            $('#ikanCount').text('Total: ' + dataToShow.length + ' / ' + AppState.masterData.ikan.length + ' jenis ikan');
            
            $('.btn-update-harga').off('click').on('click', async function() {
                await DataManager.updateHargaIkan($(this).data('ikan'), $(this).closest('tr').find('.harga-edit').val());
            });
            
            $('.btn-delete-ikan').off('click').on('click', async function() {
                if (confirm('Hapus ikan "' + $(this).data('ikan') + '"?')) {
                    await DataManager.deleteIkan($(this).data('ikan'));
                }
            });
        },
        
        displayBongkaranList: function() {
            var tbody = $('#listBongkaran');
            tbody.empty();
            if (AppState.masterData.bongkaran && AppState.masterData.bongkaran.length) {
                var unique = [];
                for (var i = 0; i < AppState.masterData.bongkaran.length; i++) {
                    var b = AppState.masterData.bongkaran[i];
                    if (b && b.trim() && unique.indexOf(b) === -1) unique.push(b);
                }
                if (unique.length) {
                    for (var i = 0; i < unique.length; i++) {
                        tbody.append('<tr><td class="text-center">' + (i + 1) + '</td><td>' + unique[i] + '</td>' +
                            '<td class="text-center"><button class="btn btn-sm btn-danger btn-delete-bongkaran" data-bongkaran="' + unique[i].replace(/"/g, '&quot;') + '"><i class="fas fa-trash"></i> Hapus</button></td></tr>');
                    }
                } else {
                    tbody.append('<tr><td colspan="3" class="text-center">Belum ada data</td></tr>');
                }
            } else {
                tbody.append('<tr><td colspan="3" class="text-center">Belum ada data</td></tr>');
            }
            $('#bongkaranCount').text('Total: ' + AppState.masterData.bongkaran.length + ' bongkaran');
        },
        
        refreshMasterDisplay: function() {
            UIManager.displayPembeliList();
            UIManager.displayIkanList($('#searchIkan').val());
            UIManager.displayBongkaranList();
        },
        
        showMasterSection: function(section) {
            $('#sectionPembeli, #sectionIkan, #sectionBongkaran').hide();
            if (section === 'pembeli') {
                $('#sectionPembeli').show();
                $('#sidebarPembeli').addClass('active');
                $('#sidebarIkan,#sidebarBongkaran').removeClass('active');
            } else if (section === 'ikan') {
                $('#sectionIkan').show();
                $('#sidebarIkan').addClass('active');
                $('#sidebarPembeli,#sidebarBongkaran').removeClass('active');
                $('#searchIkan').val('');
                UIManager.displayIkanList('');
            } else if (section === 'bongkaran') {
                $('#sectionBongkaran').show();
                $('#sidebarBongkaran').addClass('active');
                $('#sidebarPembeli,#sidebarIkan').removeClass('active');
            }
        }
    };
    
    // ============================================================
    // 🖨️ CETAK LAPORAN
    // ============================================================
    
    function cetakRekap() {
        var data = AppState.masterData.rekap.slice();
        var tglMulai = $('#filterTglMulai').val();
        var tglSelesai = $('#filterTglSelesai').val();
        var pembeliFilter = $('#filterPembeli').val();
        var metodeFilter = $('#filterMetodePembayaran').val();
        
        if (tglMulai) data = data.filter(function(i) { return i.tanggal >= tglMulai; });
        if (tglSelesai) data = data.filter(function(i) { return i.tanggal <= tglSelesai; });
        if (pembeliFilter && pembeliFilter !== 'all') data = data.filter(function(i) { return i.pembeli === pembeliFilter; });
        if (metodeFilter && metodeFilter !== 'all') data = data.filter(function(i) { return i.metodePembayaran === metodeFilter; });
        
        if (data.length === 0) {
            alert('Tidak ada data untuk dicetak!');
            return;
        }
        
        var groupedByPembeli = {};
        data.forEach(function(item) {
            if (!groupedByPembeli[item.pembeli]) groupedByPembeli[item.pembeli] = [];
            groupedByPembeli[item.pembeli].push(item);
        });
        
        var hasAnyDP = data.some(function(item) { return item.dp > 0; });
        var periodText = Utils.formatTanggalIndonesia(tglMulai) + ' s/d ' + Utils.formatTanggalIndonesia(tglSelesai);
        var LOGO_URL = "assets/images/logo-rpu.png";
        var printWindow = window.open('', '_blank');
        
        var headerHTML = '<div class="print-header"><div class="print-logo"><img src="' + LOGO_URL + '" class="print-logo-img" onerror="this.style.display=\'none\'"><div><div class="print-title">PT. RAFASYA PUTRA USTANTO</div><div class="print-company">Laporan Penjualan Ikan</div><div class="print-address">Desa Wonosari RT 03 RW 04 Kecamatan Bonang Kabupaten Demak</div></div></div></div><div class="print-info"><div><strong>📅 Periode:</strong> ' + periodText + '</div></div>';
        
        var htmlContent = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Laporan Penjualan Ikan</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Poppins",Arial,sans-serif;padding:30px 50px;background:white}.print-container{max-width:1400px;margin:0 auto}.print-header{text-align:center;margin-bottom:30px;border-bottom:3px solid #2c7da0;padding-bottom:20px}.print-logo{display:flex;align-items:center;justify-content:center;gap:20px;margin-bottom:10px;flex-wrap:wrap}.print-logo-img{width:90px;height:90px;object-fit:contain}.print-title{font-size:26px;font-weight:bold;color:#2c7da0}.print-company{font-size:15px;color:#555}.print-address{font-size:12px;color:#777}.print-info{margin:20px 0 25px 0;padding:15px 20px;border:1px solid #dee2e6;border-radius:10px;background:#f8f9fa;font-size:14px}.pembeli-title{text-align:center;margin-bottom:25px}.pembeli-title span{display:inline-block;background-color:#ffff00;color:black;padding:10px 25px;border-radius:30px;font-weight:bold;font-size:20px}.print-pembeli-wrapper{page-break-inside:avoid;margin-bottom:50px}table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:15px}th,td{border:1px solid #000000;padding:12px 10px;vertical-align:top;font-weight:bold !important}th{background:#ffff00 !important;color:black !important;text-align:center;vertical-align:middle;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:15px;padding:12px 10px}.text-end{text-align:right}.text-start{text-align:left}.text-center{text-align:center}.footer-label{text-align:right !important}.footer-nominal{text-align:left !important}.total-row td{background:#e9ecef !important}.dp-row td{background:#fff3e0 !important;-webkit-print-color-adjust:exact}.tagihan-row td{background:#FFF341 !important;-webkit-print-color-adjust:exact;font-size:24px !important}@media print{body{padding:20px 40px}th{background:#ffff00 !important;color:black !important;-webkit-print-color-adjust:exact}.tagihan-row td{background:#FFF341 !important;font-size:16px !important}}</style></head><body><div class="print-container">';
        
        var sortedPembeli = Object.keys(groupedByPembeli).sort();
        var isFirstPembeli = true;
        
        for (var p = 0; p < sortedPembeli.length; p++) {
            var pembeli = sortedPembeli[p];
            var items = groupedByPembeli[pembeli];
            if (!isFirstPembeli) {
                htmlContent += '<div style="page-break-before: always;"></div>';
            }
            isFirstPembeli = false;
            htmlContent += '<div class="print-pembeli-wrapper">';
            htmlContent += headerHTML;
            items.sort(function(a, b) { return a.tanggal.localeCompare(b.tanggal); });
            var groupedByDate = {};
            items.forEach(function(item) {
                if (!groupedByDate[item.tanggal]) groupedByDate[item.tanggal] = [];
                groupedByDate[item.tanggal].push(item);
            });
            var tanggalKeys = Object.keys(groupedByDate).sort();
            var hasThisPembeliDP = items.some(function(item) { return item.dp > 0; });
            var showDPColumn = hasAnyDP && hasThisPembeliDP;
            htmlContent += '<div class="pembeli-title"><span>' + pembeli.toUpperCase() + '</span></div>';
            htmlContent += '<table><thead><tr>';
            if (showDPColumn) {
                htmlContent += '<th>No</th><th>Hari</th><th>Tanggal</th><th>Jenis Ikan</th><th>Jumlah (kg)</th><th>Harga (Rp)</th><th>Total (Rp)</th><th>DP (Rp)</th>';
            } else {
                htmlContent += '<th>No</th><th>Hari</th><th>Tanggal</th><th>Jenis Ikan</th><th>Jumlah (kg)</th><th>Harga (Rp)</th><th>Total (Rp)</th>';
            }
            htmlContent += '</tr></thead><tbody>';
            var totalPembelian = 0;
            var totalDp = 0;
            var rowCounter = 1;
            for (var t = 0; t < tanggalKeys.length; t++) {
                var key = tanggalKeys[t];
                var dateItems = groupedByDate[key];
                var tglFormatted = Utils.formatTanggalCetak(key);
                var hari = dateItems[0].hari;
                var dpTanggal = 0;
                for (var d = 0; d < dateItems.length; d++) {
                    if (dateItems[d].dp > 0) { dpTanggal = dateItems[d].dp; break; }
                }
                for (var i = 0; i < dateItems.length; i++) {
                    var item = dateItems[i];
                    var subtotal = item.jumlah * item.harga;
                    htmlContent += '<tr>';
                    if (i === 0) {
                        htmlContent += '<td rowspan="' + dateItems.length + '" class="text-center" style="vertical-align:top">' + rowCounter + '</td>';
                        htmlContent += '<td rowspan="' + dateItems.length + '" class="text-center" style="vertical-align:top">' + hari + '</td>';
                        htmlContent += '<td rowspan="' + dateItems.length + '" class="text-center" style="vertical-align:top">' + tglFormatted + '</td>';
                    }
                    htmlContent += '<td class="text-center">' + item.jenisIkan + '</td>';
                    htmlContent += '<td class="text-center">' + item.jumlah.toLocaleString('id-ID') + '</td>';
                    htmlContent += '<td class="text-start">' + Utils.formatRupiah(item.harga) + '</td>';
                    htmlContent += '<td class="text-start">' + Utils.formatRupiah(subtotal) + '</td>';
                    if (showDPColumn && i === 0) {
                        var dpDisplay = dpTanggal > 0 ? Utils.formatRupiah(dpTanggal) : '-';
                        htmlContent += '<td rowspan="' + dateItems.length + '" class="text-start" style="vertical-align:top">' + dpDisplay + '</td>';
                    }
                    htmlContent += '</tr>';
                    totalPembelian += subtotal;
                }
                totalDp += dpTanggal;
                rowCounter++;
            }
            var totalTagihan = totalPembelian - totalDp;
            if (showDPColumn) {
                htmlContent += '<tr class="total-row"><td colspan="6" class="footer-label text-end fw-bold">TOTAL PEMBELIAN</td><td colspan="2" class="footer-nominal text-start fw-bold">' + Utils.formatRupiah(totalPembelian) + '</td></tr>';
                if (totalDp > 0) {
                    htmlContent += '<tr class="dp-row"><td colspan="6" class="footer-label text-end fw-bold">TOTAL DP</td><td colspan="2" class="footer-nominal text-start fw-bold">' + Utils.formatRupiah(totalDp) + '</td></tr>';
                }
                htmlContent += '<tr class="tagihan-row"><td colspan="6" class="footer-label text-center fw-bold">TOTAL TAGIHAN (' + pembeli.toUpperCase() + ')</td><td colspan="2" class="footer-nominal text-start fw-bold">' + Utils.formatRupiah(totalTagihan) + '</td></tr>';
            } else {
                htmlContent += '<tr class="tagihan-row"><td colspan="6" class="footer-label text-center fw-bold">TOTAL TAGIHAN (' + pembeli.toUpperCase() + ')</td><td class="footer-nominal text-start fw-bold">' + Utils.formatRupiah(totalTagihan) + '</td></tr>';
            }
            htmlContent += '</tbody></table></div>';
        }
        htmlContent += '</div><script>window.onload=function(){window.print();setTimeout(function(){window.close();},1000);};<\/script></body></html>';
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        setTimeout(function() { printWindow.close(); }, 1000);
    }
    
    // ============================================================
    // 🚀 MASTER CRUD OPERATIONS
    // ============================================================
    
    DataManager.tambahPembeli = async function(nama) {
        if (!nama.trim()) return false;
        await fetch(SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "addPembeli", nama: nama }) });
        await DataManager.loadAll();
        UIManager.refreshMasterDisplay();
        return true;
    };
    
    DataManager.tambahIkan = async function(nama, harga) {
        if (!nama.trim()) return false;
        await fetch(SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "addIkan", nama: nama, harga: parseFloat(harga) || 0 }) });
        await DataManager.loadAll();
        UIManager.refreshMasterDisplay();
        return true;
    };
    
    DataManager.updateHargaIkan = async function(nama, hargaBaru) {
        await fetch(SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "updateHargaIkan", nama: nama, harga: parseFloat(hargaBaru) || 0 }) });
        await DataManager.loadAll();
        UIManager.refreshMasterDisplay();
        return true;
    };
    
    DataManager.deleteIkan = async function(nama) {
        await fetch(SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteIkan", nama: nama }) });
        await DataManager.loadAll();
        UIManager.refreshMasterDisplay();
        return true;
    };
    
    DataManager.tambahBongkaran = async function(nama) {
        if (!nama.trim()) return false;
        await fetch(SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "addBongkaran", nama: nama }) });
        await DataManager.loadAll();
        UIManager.refreshMasterDisplay();
        UIManager.updateBongkaranDatalist();
        return true;
    };
    
    DataManager.deleteBongkaran = async function(nama) {
        await fetch(SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteBongkaran", nama: nama }) });
        await DataManager.loadAll();
        UIManager.refreshMasterDisplay();
        UIManager.updateBongkaranDatalist();
        return true;
    };
    
    // ============================================================
    // 🎯 GLOBAL EXPOSE
    // ============================================================
    
    window.addItemToBatch = BatchManager.addItem;
    window.removeBatch = BatchManager.remove;
    window.removeItemFromBatch = BatchManager.removeItem;
    window.calculateItemSubtotal = BatchManager.calculateItemSubtotal;
    window.cetakRekap = cetakRekap;
    
    // ============================================================
    // 🚀 INITIALIZATION
    // ============================================================
    
    $(document).ready(function() {
        // ===== TANGGAL CHANGE =====
        $('#tanggal').on('change', function() {
            if (this.value) $('#hari').val(Utils.getHariFromDate(this.value));
        });
        
        // ===== BUTTON EVENTS =====
        $('#btnTambahBatch').on('click', function() {
            BatchManager.add('', $('#bongkaranBatchGlobal').val() || '', 0, $('#metodePembayaranBatch').val() || CONFIG.DEFAULT_METODE);
            BatchManager.updateSummary();
            setTimeout(function() {
                var lastBatch = $('#batchContainer .batch-item:last-child');
                if (lastBatch.length) {
                    $('html, body').animate({ scrollTop: lastBatch.offset().top - 100 }, 300);
                    lastBatch.find('.select-pembeli-batch').select2('open');
                }
            }, 200);
        });
        
        $('#btnSimpanBatch').on('click', DataManager.saveBatch);
        $('#btnFilterData').on('click', UIManager.filterData);
        $('#btnCetakRekap').on('click', cetakRekap);
        $('#btnTampilkanRekapBongkaran').on('click', UIManager.tampilkanRekapBongkaran);
        $('#btnCetakRekapBongkaran').on('click', UIManager.cetakRekapBongkaran);
        $('#searchIkan').on('keyup', function() { UIManager.displayIkanList($(this).val()); });
        $('#resetSearchIkan').on('click', function() { $('#searchIkan').val(''); UIManager.displayIkanList(''); });
        
        // ===== MASTER DATA BUTTONS =====
        $(document).on('click', '#btnTambahPembeli', async function() {
            await DataManager.tambahPembeli($('#newPembeli').val());
            $('#newPembeli').val('');
        });
        
        $(document).on('click', '#btnTambahIkan', async function() {
            await DataManager.tambahIkan($('#newIkan').val(), $('#newHargaIkan').val());
            $('#newIkan').val('');
            $('#newHargaIkan').val('');
        });
        
        $(document).on('click', '#btnTambahBongkaran', async function() {
            await DataManager.tambahBongkaran($('#newBongkaran').val());
            $('#newBongkaran').val('');
        });
        
        $(document).on('click', '.btn-delete-bongkaran', async function() {
            await DataManager.deleteBongkaran($(this).data('bongkaran'));
        });
        
        // ===== SIDEBAR =====
        $(document).on('click', '#sidebarPembeli', function(e) {
            e.preventDefault();
            UIManager.showMasterSection('pembeli');
        });
        $(document).on('click', '#sidebarIkan', function(e) {
            e.preventDefault();
            UIManager.showMasterSection('ikan');
        });
        $(document).on('click', '#sidebarBongkaran', function(e) {
            e.preventDefault();
            UIManager.showMasterSection('bongkaran');
        });
        $('#tabMaster').on('shown.bs.tab', function() {
            UIManager.showMasterSection('pembeli');
        });
        
        // ===== REATTACH EVENTS =====
        EventManager.reattachGlobal();
        
        // ===== LOAD DATA =====
        DataManager.loadAll();
        
        // ===== INIT SCROLL MANAGER =====
        ScrollManager.init();
        
        // ===== TRIGGER TANGGAL =====
        $('#tanggal').trigger('change');
    });
    
})();
