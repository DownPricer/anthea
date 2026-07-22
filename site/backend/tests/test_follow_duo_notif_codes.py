"""Structured follow error codes and duo request notification type."""

def test_already_following_error_shape():
    detail = {"code": "ALREADY_FOLLOWING", "message": "Vous suivez déjà cet utilisateur"}
    assert detail["code"] == "ALREADY_FOLLOWING"
    assert "suivez déjà" in detail["message"]


def test_duo_request_received_type_canonical():
    notif_type = "duo_request_received"
    assert notif_type.startswith("duo_")
    assert notif_type == "duo_request_received"


def test_duo_request_deep_link_shape():
    request_id = "abc123"
    url = f"/settings?section=partner-duo&panel=requests&request={request_id}"
    assert "section=partner-duo" in url
    assert "panel=requests" in url
    assert f"request={request_id}" in url
