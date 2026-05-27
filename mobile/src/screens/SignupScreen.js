import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function SignupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();
  const role = route.params?.role || 'client';
  const isBusiness = role === 'business_owner';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [serviceRadius, setServiceRadius] = useState('25');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignup() {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (isBusiness && !businessName.trim()) {
      setError('Business name is required.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        password,
        role,
      };
      if (isBusiness) {
        payload.business_name = businessName.trim();
        payload.category = category.trim() || 'General';
        payload.service_radius_km = parseInt(serviceRadius, 10) || 25;
      }
      const result = await signup(payload);
      if (result?.requiresConfirmation) {
        // Email confirmation required — show message, go to Login.
        navigation.navigate('Login');
        setError('');
        // Brief message (navigation clears it, but visible for a moment).
      }
      // If requiresConfirmation is false, AuthContext already set user → app auto-navigates.
    } catch (err) {
      setError(err.message || 'Signup failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{isBusiness ? 'List your business' : 'Create an account'}</Text>
        <Text style={styles.subtitle}>
          {isBusiness ? 'Start getting jobs from Calgary locals' : 'Book local services in minutes'}
        </Text>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>First name *</Text>
              <TextInput style={styles.input} placeholder="Ali" placeholderTextColor="#3a424c"
                value={firstName} onChangeText={setFirstName} />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Last name *</Text>
              <TextInput style={styles.input} placeholder="Hassan" placeholderTextColor="#3a424c"
                value={lastName} onChangeText={setLastName} />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor="#3a424c"
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} placeholder="+1 403 555 0100" placeholderTextColor="#3a424c"
              value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password *</Text>
            <TextInput style={styles.input} placeholder="Min. 8 characters" placeholderTextColor="#3a424c"
              value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          {isBusiness && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>Business Details</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Business name *</Text>
                <TextInput style={styles.input} placeholder="Ahmed's Cleaning Co." placeholderTextColor="#3a424c"
                  value={businessName} onChangeText={setBusinessName} />
              </View>

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>Category</Text>
                  <TextInput style={styles.input} placeholder="Cleaning" placeholderTextColor="#3a424c"
                    value={category} onChangeText={setCategory} />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Radius (km)</Text>
                  <TextInput style={styles.input} placeholder="25" placeholderTextColor="#3a424c"
                    value={serviceRadius} onChangeText={setServiceRadius} keyboardType="numeric" />
                </View>
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSignup}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Create account →</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginAccent}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  scroll: { flex: 1 },
  inner: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  back: { marginBottom: 28 },
  backText: { fontSize: 15, color: '#9ca3af', fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 28 },
  form: { gap: 14 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, gap: 7 },
  field: { gap: 7 },
  label: { fontSize: 11, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#2a2e33',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#f0ede8',
  },
  divider: { height: 1, backgroundColor: '#1a1d1f', marginVertical: 4 },
  sectionLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  error: { fontSize: 13, color: '#f87171', fontWeight: '500' },
  btn: {
    backgroundColor: '#FF5C00', borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    marginTop: 8, shadowColor: '#FF5C00', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  loginLink: { marginTop: 28, alignItems: 'center' },
  loginText: { fontSize: 14, color: '#6b7280' },
  loginAccent: { color: '#FF5C00', fontWeight: '600' },
});
