import React from 'react';
import { View, Pressable } from 'react-native';
import Text from './Text';
import { colors, spacing, radius } from '../theme/tokens';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleReload = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}>
          <Text style={{
            fontSize: 20,
            fontFamily: 'SpaceGrotesk_700Bold',
            color: colors.textPrimary,
            marginBottom: spacing.md,
          }}>
            Something went wrong
          </Text>
          <Text style={{
            fontSize: 14,
            color: colors.textSecondary,
            textAlign: 'center',
            marginBottom: spacing.lg,
          }}>
            This screen ran into a problem. Tap below to try again.
          </Text>
          <Pressable
            onPress={this.handleReload}
            style={{
              backgroundColor: colors.accent,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.button,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontFamily: 'Inter_600SemiBold' }}>
              Reload
            </Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
