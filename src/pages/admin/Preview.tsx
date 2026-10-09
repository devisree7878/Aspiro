import { useParams } from 'react-router-dom'
import Player from '../../features/learning/Player'
export default function Preview() { const { dayId } = useParams(); return <Player preview dayIdProp={dayId} /> }
