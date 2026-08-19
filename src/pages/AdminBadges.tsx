import { Navigate } from "react-router-dom";

/** Nahrávání badge má teď vlastní záložku v Administraci → Kosmetika. */
const AdminBadges = () => <Navigate to="/admin/cosmetics?tab=badges" replace />;

export default AdminBadges;
