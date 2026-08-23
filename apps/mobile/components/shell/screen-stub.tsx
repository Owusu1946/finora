import { View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';

type ScreenStubProps = {
  title: string;
  description: string;
};

export function ScreenStub({ title, description }: ScreenStubProps) {
  return (
    <View className='flex-1 bg-background px-6 pt-6'>
      <Text className='mb-2 font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
        {title}
      </Text>
      <Text className='max-w-[340px] font-sans text-[17px] leading-6 tracking-[-0.2px] text-muted-foreground'>
        {description}
      </Text>
    </View>
  );
}
