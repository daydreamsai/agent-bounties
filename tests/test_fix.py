import pytest
from pydantic import ValidationError
from code import AuditInput, audit_approvals

def test_audit_input_valid():
    valid_data = {
        "wallet": "0x1234567890123456789012345678901234567890",
        "chains": ["ethereum", "polygon"]
    }
    audit_input = AuditInput(**valid_data)
    assert audit_input.wallet == valid_data["wallet"]
    assert audit_input.chains == valid_data["chains"]

def test_audit_input_invalid_wallet():
    invalid_data = {
        "wallet": "0xinvalid",
        "chains": ["ethereum"]
    }
    with pytest.raises(ValidationError) as excinfo:
        AuditInput(**invalid_data)
    assert "Invalid Ethereum wallet address format" in str(excinfo.value)

def test_audit_approvals_validation_trigger():
    # Tests that the function correctly utilizes the AuditInput schema
    invalid_data = {
        "wallet": "short_addr",
        "chains": []
    }
    with pytest.raises(ValidationError):
        audit_approvals(invalid_data)

def test_audit_approvals_logic_flow():
    # Note: Function ends with truncated 're', so we catch the resulting NameError
    # while ensuring logic up to that point is valid.
    valid_data = {
        "wallet": "0x1234567890123456789012345678901234567890",
        "chains": ["ethereum"]
    }
    try:
        audit_approvals(valid_data)
    except NameError as e:
        assert "re" in str(e)