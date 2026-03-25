import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useToast } from '../../context/ToastContext';
import { colors, spacing, radius, shadow } from '../../constants/theme';

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export default function LoginScreen() {
    const router = useRouter();
    const { showSuccess, showError, showInfo } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const validate = () => {
        const e = {};
        if (!email.trim()) e.email = 'Email is required';
        else if (!validateEmail(email)) e.email = 'Enter a valid email address';
        if (!password.trim()) e.password = 'Password is required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleLogin = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const userData = await AsyncStorage.getItem('user');
            if (!userData) {
                showInfo('No account found. Please register first.');
                return;
            }
            const user = JSON.parse(userData);
            if (user.email === email.trim() && user.password === password) {
                if (user.preferredLanguage) {
                    await AsyncStorage.setItem('preferredLanguage', user.preferredLanguage);
                }
                showSuccess('Login successful! Welcome back.');
                setTimeout(() => router.replace('/(tabs)/home'), 500);
            } else {
                showError('Invalid email or password. Please try again.');
                setErrors({ password: 'Incorrect credentials' });
            }
        } catch {
            showError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Welcome back</Text>
                    <Text style={styles.subtitle}>Sign in to continue managing your medications</Text>
                </View>

                <View style={styles.form}>
                    {/* Email */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Email address</Text>
                        <View style={[styles.inputWrap, errors.email && styles.inputError]}>
                            <MaterialIcons name="email" size={18} color={errors.email ? colors.error : colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="you@example.com"
                                placeholderTextColor={colors.textMuted}
                                value={email}
                                onChangeText={(t) => { setEmail(t); setErrors(p => ({ ...p, email: '' })); }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                editable={!loading}
                            />
                        </View>
                        {errors.email ? <Text style={styles.errorText}><MaterialIcons name="error-outline" size={12} /> {errors.email}</Text> : null}
                    </View>

                    {/* Password */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={[styles.inputWrap, errors.password && styles.inputError]}>
                            <MaterialIcons name="lock" size={18} color={errors.password ? colors.error : colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="Enter your password"
                                placeholderTextColor={colors.textMuted}
                                value={password}
                                onChangeText={(t) => { setPassword(t); setErrors(p => ({ ...p, password: '' })); }}
                                secureTextEntry={!showPassword}
                                editable={!loading}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.btn, loading && styles.btnDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading
                        ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.btnText}>Signing in...</Text></>
                        : <Text style={styles.btnText}>Login</Text>
                    }
                </TouchableOpacity>

                <TouchableOpacity style={styles.link} onPress={() => router.push('/auth/register')} disabled={loading}>
                    <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Register</Text></Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
    header: { marginBottom: spacing.xl },
    title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 6, lineHeight: 20 },
    form: { gap: 16, marginBottom: spacing.lg },
    fieldGroup: { gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: radius.md,
        borderWidth: 1.5, borderColor: colors.border,
        paddingHorizontal: 14, height: 52,
        ...shadow.sm,
    },
    inputError: { borderColor: colors.error, backgroundColor: colors.errorLight },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, color: colors.textPrimary },
    eyeBtn: { padding: 4 },
    errorText: { fontSize: 12, color: colors.error, fontWeight: '500', marginTop: 2 },
    btn: {
        backgroundColor: colors.primary, height: 54,
        borderRadius: radius.md, justifyContent: 'center', alignItems: 'center',
        flexDirection: 'row', gap: 8,
        marginBottom: spacing.md, ...shadow.lg,
    },
    btnDisabled: { backgroundColor: colors.textMuted },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    link: { alignItems: 'center', padding: spacing.sm },
    linkText: { fontSize: 14, color: colors.textSecondary },
    linkBold: { color: colors.primary, fontWeight: '700' },
});
