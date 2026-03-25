import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useToast } from '../../context/ToastContext';
import { colors, spacing, radius, shadow } from '../../constants/theme';

const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const getPasswordStrength = (p) => {
    if (!p) return null;
    if (p.length < 6) return { label: 'Too short', color: colors.error, width: '20%' };
    if (p.length < 8 || !/[0-9]/.test(p)) return { label: 'Weak', color: colors.warning, width: '50%' };
    if (!/[A-Z]/.test(p) || !/[!@#$%^&*]/.test(p)) return { label: 'Good', color: '#2563EB', width: '75%' };
    return { label: 'Strong', color: colors.success, width: '100%' };
};

export default function RegisterScreen() {
    const router = useRouter();
    const { showSuccess, showError } = useToast();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [caretakerEmail, setCaretakerEmail] = useState('');
    const [language, setLanguage] = useState('en'); // Default to English
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const strength = getPasswordStrength(password);

    const validate = () => {
        const e = {};
        if (!username.trim()) e.username = 'Username is required';
        else if (username.trim().length < 3) e.username = 'Minimum 3 characters';
        if (!email.trim()) e.email = 'Email is required';
        else if (!validateEmail(email)) e.email = 'Enter a valid email address';
        if (!password) e.password = 'Password is required';
        else if (password.length < 6) e.password = 'Password must be at least 6 characters';
        if (!caretakerEmail.trim()) e.caretaker = 'Caretaker email is required';
        else if (!validateEmail(caretakerEmail)) e.caretaker = 'Enter a valid caretaker email';
        else if (caretakerEmail.trim() === email.trim()) e.caretaker = 'Must be different from your email';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleRegister = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const existing = await AsyncStorage.getItem('user');
            if (existing) {
                const u = JSON.parse(existing);
                if (u.email === email.trim()) {
                    showError('An account with this email already exists.');
                    setErrors({ email: 'Email already registered' });
                    return;
                }
            }
            await AsyncStorage.setItem('user', JSON.stringify({
                username: username.trim(),
                email: email.trim(),
                password,
                caretakerEmail: caretakerEmail.trim(),
                preferredLanguage: language
            }));
            await AsyncStorage.setItem('preferredLanguage', language);
            showSuccess('Account created! Redirecting you now...');
            setTimeout(() => router.replace('/(tabs)/home'), 800);
        } catch {
            showError('Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.title}>Create account</Text>
                    <Text style={styles.subtitle}>Set up your profile to start tracking medications</Text>
                </View>

                <View style={styles.form}>
                    {/* Username */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Your Name</Text>
                        <View style={[styles.inputWrap, errors.username && styles.inputError]}>
                            <MaterialIcons name="person" size={18} color={errors.username ? colors.error : colors.textMuted} style={styles.icon} />
                            <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor={colors.textMuted}
                                value={username} onChangeText={(t) => { setUsername(t); setErrors(p => ({ ...p, username: '' })); }}
                                autoCapitalize="words" editable={!loading} />
                        </View>
                        {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
                    </View>

                    {/* Email */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Your Email</Text>
                        <View style={[styles.inputWrap, errors.email && styles.inputError]}>
                            <MaterialIcons name="email" size={18} color={errors.email ? colors.error : colors.textMuted} style={styles.icon} />
                            <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={colors.textMuted}
                                value={email} onChangeText={(t) => { setEmail(t); setErrors(p => ({ ...p, email: '' })); }}
                                autoCapitalize="none" keyboardType="email-address" editable={!loading} />
                        </View>
                        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
                    </View>

                    {/* Password */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={[styles.inputWrap, errors.password && styles.inputError]}>
                            <MaterialIcons name="lock" size={18} color={errors.password ? colors.error : colors.textMuted} style={styles.icon} />
                            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Min. 6 characters" placeholderTextColor={colors.textMuted}
                                value={password} onChangeText={(t) => { setPassword(t); setErrors(p => ({ ...p, password: '' })); }}
                                secureTextEntry={!showPassword} editable={!loading} />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        {password ? (
                            <View style={styles.strengthWrap}>
                                <View style={styles.strengthBar}>
                                    <View style={[styles.strengthFill, { width: strength.width, backgroundColor: strength.color }]} />
                                </View>
                                <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                            </View>
                        ) : null}
                        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                    </View>

                    {/* Caretaker Email */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Caretaker Email</Text>
                        <Text style={styles.hint}>This person will be alerted if you miss doses</Text>
                        <View style={[styles.inputWrap, errors.caretaker && styles.inputError]}>
                            <MaterialIcons name="people" size={18} color={errors.caretaker ? colors.error : colors.textMuted} style={styles.icon} />
                            <TextInput style={styles.input} placeholder="caretaker@example.com" placeholderTextColor={colors.textMuted}
                                value={caretakerEmail} onChangeText={(t) => { setCaretakerEmail(t); setErrors(p => ({ ...p, caretaker: '' })); }}
                                autoCapitalize="none" keyboardType="email-address" editable={!loading} />
                        </View>
                        {errors.caretaker ? <Text style={styles.errorText}>{errors.caretaker}</Text> : null}
                    </View>

                    {/* Language Selection */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Preferred Language</Text>
                        <Text style={styles.hint}>Language for voice alarms and reminders</Text>
                        <View style={styles.langRow}>
                            <TouchableOpacity 
                                style={[styles.langBtn, language === 'en' && styles.langBtnActive]} 
                                onPress={() => setLanguage('en')}
                            >
                                <Ionicons name="language" size={18} color={language === 'en' ? '#fff' : colors.textSecondary} />
                                <Text style={[styles.langBtnTxt, language === 'en' && styles.langBtnTxtActive]}>English</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.langBtn, language === 'te' && styles.langBtnActive]} 
                                onPress={() => setLanguage('te')}
                            >
                                <MaterialIcons name="translate" size={18} color={language === 'te' ? '#fff' : colors.textSecondary} />
                                <Text style={[styles.langBtnTxt, language === 'te' && styles.langBtnTxtActive]}>Telugu (తెలుగు)</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.btn, loading && styles.btnDisabled]}
                    onPress={handleRegister} disabled={loading} activeOpacity={0.85}
                >
                    {loading
                        ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.btnText}>Creating account...</Text></>
                        : <Text style={styles.btnText}>Create Account</Text>
                    }
                </TouchableOpacity>

                <TouchableOpacity style={styles.link} onPress={() => router.back()} disabled={loading}>
                    <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Login</Text></Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40 },
    header: { marginTop: spacing.lg, marginBottom: spacing.xl },
    title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 6, lineHeight: 20 },
    form: { gap: 18, marginBottom: spacing.lg },
    fieldGroup: { gap: 5 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    hint: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: radius.md,
        borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, height: 52,
        ...shadow.sm,
    },
    inputError: { borderColor: colors.error, backgroundColor: colors.errorLight },
    icon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, color: colors.textPrimary },
    eyeBtn: { padding: 4 },
    errorText: { fontSize: 12, color: colors.error, fontWeight: '500' },
    strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    strengthBar: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
    strengthFill: { height: '100%', borderRadius: 2 },
    strengthLabel: { fontSize: 11, fontWeight: '700', width: 55, textAlign: 'right' },
    btn: {
        backgroundColor: colors.primary, height: 54, borderRadius: radius.md,
        justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8,
        marginBottom: spacing.md, ...shadow.lg,
    },
    btnDisabled: { backgroundColor: colors.textMuted },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    link: { alignItems: 'center', padding: spacing.sm },
    linkText: { fontSize: 14, color: colors.textSecondary },
    linkBold: { color: colors.primary, fontWeight: '700' },
    langRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    langBtn: {
        flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface
    },
    langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    langBtnTxt: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    langBtnTxtActive: { color: '#fff', fontWeight: '800' },
});
