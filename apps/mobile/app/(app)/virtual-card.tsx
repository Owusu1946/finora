import { VirtualCardRequestFlow } from '@/components/cards/VirtualCardRequestFlow';
import { SwipeBackView } from '@/components/navigation/swipe-back-view';

export default function VirtualCardScreen() {
  return (
    <SwipeBackView>
      <VirtualCardRequestFlow />
    </SwipeBackView>
  );
}
