import { Stack } from 'expo-router';
import { useTheme } from '../../src/design/ThemeContext';

export default function AppLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'none',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="inspiration/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="inspiration/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="thought/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="thought/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="project/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="project/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="trash/index" options={{ presentation: 'card' }} />
    </Stack>
  );
}
