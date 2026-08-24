import { View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';

export function AuthDivider() {
  return (
    <View className='flex-row items-center gap-3'>
      <View className='h-px flex-1 bg-border' />
      <Text className='font-sans-medium text-sm text-muted-foreground'>or</Text>
      <View className='h-px flex-1 bg-border' />
    </View>
  );
}
