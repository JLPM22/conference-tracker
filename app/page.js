import ConferenceDashboard from '../components/ConferenceDashboard';
import graphics from '../data/graphics.json';
import visionRobotics from '../data/vision-robotics.json';
import hci from '../data/vr-hci.json';
import ai from '../data/ai.json';

export default function Home() {
  return <ConferenceDashboard conferences={[...graphics, ...visionRobotics, ...hci, ...ai]} />;
}
