import { useParams } from 'react-router-dom';
import { DuoProfilePage } from './DuoProfilePage';

export function PublicDuoProfilePage() {
  const { tag } = useParams();
  const decodedTag = tag ? decodeURIComponent(tag) : '';

  return <DuoProfilePage tag={decodedTag} />;
}
