import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView, TextInput, ActivityIndicator, Platform, UIManager, Modal } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useMedicines } from '../../context/MedicineContext';
import { useToast } from '../../context/ToastContext';
import { normalizeFrequency } from '../../utils/ReminderEngine';
import { BACKEND_URL } from '../../constants/api';
import { colors, spacing, radius, shadow } from '../../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FREQUENCY_OPTIONS = ['Once daily', 'Twice daily', 'Three times daily'];

const getDefaultTimes = (freq) => {
    const n = normalizeFrequency(freq);
    if (n === 'Twice daily') return ['09:00', '21:00'];
    if (n === 'Three times daily') return ['09:00', '14:00', '21:00'];
    return ['09:00'];
};

const fmt12 = (t24) => {
    if (!t24) return '';
    const [h, m] = t24.split(':');
    const hh = parseInt(h);
    return `${hh % 12 || 12}:${m} ${hh >= 12 ? 'PM' : 'AM'}`;
};

export default function UploadScreen() {
    const router = useRouter();
    const { addPrescription } = useMedicines();
    const { showSuccess, showError, showInfo } = useToast();

    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [extractedText, setExtractedText] = useState('');
    const [showText, setShowText] = useState(false);
    const [name, setName] = useState('');
    const [dosage, setDosage] = useState('');
    const [frequency, setFrequency] = useState('');
    const [duration, setDuration] = useState('');
    const [medicinesList, setMedicinesList] = useState([]);
    const [isFreqModalVisible, setFreqModalVisible] = useState(false);
    const [freqTarget, setFreqTarget] = useState(null);
    const [isPickerVisible, setPickerVisible] = useState(false);
    const [manualTimes, setManualTimes] = useState(['09:00']);
    const [pickerTarget, setPickerTarget] = useState(null); // { id, index } or { id: 'manual', index }

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 1 });
            if (!result.canceled) { setImage(result.assets[0].uri); processImage(result.assets[0].uri); }
        } catch { showError('Could not open image gallery.'); }
    };

    const captureImage = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') { showError('Camera permission is required.'); return; }
            const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 1 });
            if (!result.canceled) { setImage(result.assets[0].uri); processImage(result.assets[0].uri); }
        } catch { showError('Could not open camera.'); }
    };

    const processImage = async (uri) => {
        setLoading(true);
        setExtractedText('');
        try {
            const formData = new FormData();
            formData.append('file', { uri, name: 'prescription.jpg', type: 'image/jpeg' });
            const res = await fetch(`${BACKEND_URL}/upload-prescription`, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } });
            const data = await res.json();
            if (data.status === 'success') {
                setExtractedText(data.extracted_text || '');
                if (data.detected_medicines?.length > 0) {
                    const meds = data.detected_medicines.map((n) => ({ id: Date.now().toString() + Math.random(), name: n, dosage: '', frequency: 'Once daily', duration: '', times: ['09:00'] }));
                    setMedicinesList(prev => [...prev, ...meds]);
                    showSuccess(`Found ${data.detected_medicines.length} medicine(s) in prescription.`);
                } else {
                    showInfo('OCR complete. No medicines auto-detected — please add manually.');
                }
            } else {
                showError(data.message || 'Failed to process the prescription image.');
            }
        } catch {
            showError('Cannot connect to backend. Make sure the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const addManual = () => {
        if (!name.trim()) { showError('Medicine name is required.'); return; }
        setMedicinesList(prev => [...prev, { id: Date.now().toString(), name: name.trim(), dosage: dosage.trim(), frequency: frequency || 'Once daily', duration: duration.trim(), times: [...manualTimes] }]);
        setName(''); setDosage(''); setFrequency(''); setDuration(''); setManualTimes(['09:00']);
        showSuccess(`${name.trim()} added to list.`);
    };

    const removeMedicine = (id) => { setMedicinesList(prev => prev.filter(m => m.id !== id)); };

    const updateField = (id, field, value) => {
        if (id === 'manual') {
            if (field === 'frequency') {
                setFrequency(value);
                setManualTimes(getDefaultTimes(value));
            }
            return;
        }
        setMedicinesList(prev => prev.map(m => {
            if (m.id !== id) return m;
            const updated = { ...m, [field]: value };
            if (field === 'frequency') updated.times = getDefaultTimes(value);
            return updated;
        }));
    };

    const handleConfirmTime = (date) => {
        if (date && pickerTarget) {
            const h = date.getHours().toString().padStart(2, '0');
            const mi = date.getMinutes().toString().padStart(2, '0');
            const newTime = `${h}:${mi}`;

            if (pickerTarget.id === 'manual') {
                setManualTimes(prev => {
                    const t = [...prev];
                    t[pickerTarget.index] = newTime;
                    return t;
                });
            } else {
                setMedicinesList(prev => prev.map(m => {
                    if (m.id !== pickerTarget.id) return m;
                    const times = [...m.times]; 
                    times[pickerTarget.index] = newTime;
                    return { ...m, times };
                }));
            }
        }
        setPickerVisible(false);
    };

    const handleSave = async () => {
        if (medicinesList.length === 0) { showError('Add at least one medicine before saving.'); return; }
        setSaving(true);
        const today = new Date();
        const finalMeds = medicinesList.map(m => {
            const d = parseInt(m.duration);
            let endDate = null;
            if (!isNaN(d) && d > 0) { const e = new Date(today); e.setDate(today.getDate() + d); endDate = e.toISOString(); }
            return { id: m.id, name: m.name, dosage: m.dosage || 'As directed', frequency: m.frequency, times: m.times, duration: !isNaN(d) && d > 0 ? `${d} days` : m.duration || 'Ongoing', startDate: today.toISOString(), endDate, type: 'pills' };
        });
        const success = await addPrescription({ imageUri: image, medicines: finalMeds });
        setSaving(false);
        if (success) {
            showSuccess('Prescription saved! Reminders scheduled.');
            setImage(null); setMedicinesList([]); setExtractedText('');
            setTimeout(() => router.navigate('medicine-list'), 600);
        } else {
            showError('Failed to save prescription. Please try again.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}><Text style={styles.headerTitle}>Scan Prescription</Text></View>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                {/* Image Section */}
                <View style={styles.imageBox}>
                    {image ? <Image source={{ uri: image }} style={styles.previewImage} /> : (
                        <View style={styles.imagePlaceholder}>
                            <FontAwesome5 name="file-prescription" size={36} color={colors.primary} />
                            <Text style={styles.placeholderText}>Upload or capture your prescription</Text>
                        </View>
                    )}
                    {loading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Reading prescription...</Text>
                        </View>
                    )}
                </View>
                <View style={styles.imgBtns}>
                    <TouchableOpacity style={[styles.imgBtn, { backgroundColor: '#16A34A' }]} onPress={captureImage} disabled={loading}>
                        <FontAwesome5 name="camera" size={16} color="#fff" /><Text style={styles.imgBtnTxt}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.imgBtn, { backgroundColor: colors.primary }]} onPress={pickImage} disabled={loading}>
                        <FontAwesome5 name="images" size={16} color="#fff" /><Text style={styles.imgBtnTxt}>Gallery</Text>
                    </TouchableOpacity>
                </View>

                {/* OCR Text */}
                {extractedText ? (
                    <View style={styles.ocrBox}>
                        <TouchableOpacity style={styles.ocrHeader} onPress={() => setShowText(!showText)}>
                            <FontAwesome5 name="file-alt" size={14} color={colors.primary} />
                            <Text style={styles.ocrTitle}>Extracted Text</Text>
                            <Ionicons name={showText ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                        </TouchableOpacity>
                        {showText && <Text style={styles.ocrRaw}>{extractedText}</Text>}
                    </View>
                ) : null}

                {/* Medicines List */}
                <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>Medicines List</Text>
                    <Text style={styles.sectionCount}>{medicinesList.length} item{medicinesList.length !== 1 ? 's' : ''}</Text>
                </View>

                {medicinesList.map((item, idx) => (
                    <View key={item.id} style={styles.medicineCard}>
                        <View style={styles.cardRow}>
                            <Text style={styles.cardIdx}>#{idx + 1}</Text>
                            <TextInput style={styles.nameInput} value={item.name} onChangeText={t => updateField(item.id, 'name', t)} placeholder="Medicine name" />
                            <TouchableOpacity onPress={() => removeMedicine(item.id)} style={styles.removeBtn}><MaterialIcons name="close" size={18} color={colors.error} /></TouchableOpacity>
                        </View>
                        <View style={styles.cardRow}>
                            <TextInput style={[styles.miniInput, { flex: 2 }]} value={item.dosage} onChangeText={t => updateField(item.id, 'dosage', t)} placeholder="Dosage" />
                            <TouchableOpacity style={[styles.selector, { flex: 2 }]} onPress={() => { setFreqTarget(item.id); setFreqModalVisible(true); }}>
                                <Text style={styles.selectorTxt}>{item.frequency || 'Frequency'}</Text>
                                <Ionicons name="chevron-down" size={12} color={colors.primary} />
                            </TouchableOpacity>
                            <TextInput style={[styles.miniInput, { flex: 1 }]} value={item.duration} onChangeText={t => updateField(item.id, 'duration', t)} placeholder="Days" keyboardType="numeric" />
                        </View>
                        <Text style={styles.timeLabel}>Reminder Times</Text>
                        <View style={styles.timeRow}>
                            {item.times.map((t, ti) => (
                                <TouchableOpacity key={ti} style={styles.timeChip} onPress={() => { setPickerTarget({ id: item.id, index: ti }); setPickerVisible(true); }}>
                                    <Ionicons name="time" size={14} color={colors.primary} />
                                    <Text style={styles.timeChipTxt}>{fmt12(t)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                {/* Manual Entry */}
                <View style={styles.dividerRow}><Text style={styles.dividerTxt}>OR ADD MANUALLY</Text></View>
                <View style={styles.manualForm}>
                    <TextInput style={styles.manualInput} placeholder="Medicine Name *" value={name} onChangeText={setName} />
                    <View style={styles.cardRow}>
                        <TextInput style={[styles.manualInput, { flex: 1 }]} placeholder="Dosage" value={dosage} onChangeText={setDosage} />
                        <View style={{ width: 8 }} />
                        <TouchableOpacity style={[styles.selector, { flex: 1, height: 48 }]} onPress={() => { setFreqTarget('manual'); setFreqModalVisible(true); }}>
                            <Text style={styles.selectorTxt}>{frequency || 'Frequency'}</Text>
                            <Ionicons name="chevron-down" size={12} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                    <TextInput style={styles.manualInput} placeholder="Duration (Days)" value={duration} onChangeText={setDuration} keyboardType="numeric" />
                    
                    <Text style={styles.timeLabel}>Reminder Times</Text>
                    <View style={styles.timeRow}>
                        {manualTimes.map((t, ti) => (
                            <TouchableOpacity key={ti} style={styles.timeChip} onPress={() => { setPickerTarget({ id: 'manual', index: ti }); setPickerVisible(true); }}>
                                <Ionicons name="time" size={14} color={colors.primary} />
                                <Text style={styles.timeChipTxt}>{fmt12(t)}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={styles.addBtn} onPress={addManual}>
                        <MaterialIcons name="add" size={20} color="#fff" />
                        <Text style={styles.addBtnTxt}>Add to List</Text>
                    </TouchableOpacity>
                </View>

                {medicinesList.length > 0 && (
                    <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                        {saving ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.saveBtnTxt}>Saving...</Text></> : <Text style={styles.saveBtnTxt}>Save Prescription</Text>}
                    </TouchableOpacity>
                )}
                <View style={{ height: 60 }} />
            </ScrollView>

            <DateTimePickerModal isVisible={isPickerVisible} mode="time" onConfirm={handleConfirmTime} onCancel={() => setPickerVisible(false)} is24Hour={true}
                date={(() => { 
                    if (!pickerTarget) return new Date(); 
                    let timeStr = '09:00';
                    if (pickerTarget.id === 'manual') {
                        timeStr = manualTimes[pickerTarget.index];
                    } else {
                        const med = medicinesList.find(m => m.id === pickerTarget.id); 
                        if (med) timeStr = med.times[pickerTarget.index];
                    }
                    const [h, m] = timeStr.split(':'); 
                    const d = new Date(); 
                    d.setHours(parseInt(h), parseInt(m)); 
                    return d; 
                })()} />

            <Modal transparent visible={isFreqModalVisible} animationType="fade" onRequestClose={() => setFreqModalVisible(false)}>
                <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setFreqModalVisible(false)}>
                    <View style={styles.freqModal}>
                        <Text style={styles.freqModalTitle}>Select Frequency</Text>
                        {FREQUENCY_OPTIONS.map(opt => (
                            <TouchableOpacity key={opt} style={styles.freqOpt} onPress={() => {
                                if (freqTarget === 'manual') updateField('manual', 'frequency', opt); else updateField(freqTarget, 'frequency', opt);
                                setFreqModalVisible(false);
                            }}>
                                <Text style={styles.freqOptTxt}>{opt}</Text>
                                {(freqTarget === 'manual' ? frequency === opt : medicinesList.find(m => m.id === freqTarget)?.frequency === opt) && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.md, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    content: { padding: spacing.md },
    imageBox: { height: 180, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    imagePlaceholder: { alignItems: 'center', gap: 10 },
    placeholderText: { fontSize: 14, color: colors.primary, fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', gap: 10 },
    loadingText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
    imgBtns: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    imgBtn: { flex: 1, height: 46, borderRadius: radius.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    imgBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
    ocrBox: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
    ocrHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
    ocrTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    ocrRaw: { padding: 12, fontSize: 12, color: colors.textSecondary, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', borderTopWidth: 1, borderTopColor: colors.border },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    sectionCount: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    medicineCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, ...shadow.sm, gap: 10 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardIdx: { fontWeight: '800', color: colors.primary, fontSize: 13, minWidth: 22 },
    nameInput: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textPrimary, borderBottomWidth: 1.5, borderBottomColor: colors.border, paddingVertical: 4 },
    removeBtn: { padding: 4, backgroundColor: colors.errorLight, borderRadius: radius.sm },
    miniInput: { backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '600', color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
    selector: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.primary + '40' },
    selectorTxt: { fontSize: 12, fontWeight: '700', color: colors.primary, flex: 1 },
    timeLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    timeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.primary + '40' },
    timeChipTxt: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    dividerRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 20 },
    dividerTxt: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, backgroundColor: colors.background, paddingHorizontal: 12 },
    manualForm: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: 10, marginBottom: 16 },
    manualInput: { backgroundColor: colors.background, borderRadius: radius.sm, padding: 14, fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: colors.border, color: colors.textPrimary },
    addBtn: { backgroundColor: '#5856D6', borderRadius: radius.md, height: 46, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4 },
    addBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
    saveBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, height: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, ...shadow.lg },
    saveBtnDisabled: { backgroundColor: colors.textMuted },
    saveBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: spacing.md },
    freqModal: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadow.md },
    freqModalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 16, textAlign: 'center' },
    freqOpt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    freqOptTxt: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
});
