from flask import Blueprint, request, jsonify, render_template
from sqlalchemy import extract
from .models import Transaction
from . import db

main = Blueprint("main", __name__)

@main.route("/")
def index():
    """Render the GUI dashboard"""
    return render_template("index.html")


def validate_transaction_data(data):
    """Validate transaction input data"""
    errors = []
    
    # Check if data exists
    if not data:
        return ["No data provided"], None
    
    # Required fields
    required_fields = ['amount', 'category', 'type']
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing required field: {field}")
    
    if errors:
        return errors, None
    
    # Validate amount
    try:
        amount = float(data['amount'])
        if amount <= 0:
            errors.append("Amount must be greater than 0")
    except (ValueError, TypeError):
        errors.append("Amount must be a valid number")
    
    # Validate category
    category = data.get('category', '').strip()
    if not category:
        errors.append("Category cannot be empty")
    elif len(category) > 50:
        errors.append("Category must be 50 characters or less")
    
    # Validate type
    transaction_type = data.get('type', '').strip().lower()
    if transaction_type not in ['income', 'expense']:
        errors.append("Type must be either 'income' or 'expense'")
    
    return errors, {
        'amount': amount,
        'category': category,
        'type': transaction_type
    }


@main.route("/transactions", methods=["POST"])
def add_transaction():
    """Add a new transaction with validation"""
    try:
        data = request.get_json()
        
        # Validate input
        errors, validated_data = validate_transaction_data(data)
        
        if errors:
            return jsonify({
                "error": "Validation failed",
                "details": errors
            }), 400
        
        # Create transaction
        transaction = Transaction(
            amount=validated_data['amount'],
            category=validated_data['category'],
            type=validated_data['type']
        )
        
        db.session.add(transaction)
        db.session.commit()
        
        return jsonify({
            "message": "Transaction added successfully",
            "transaction": transaction.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Failed to add transaction",
            "details": str(e)
        }), 500


@main.route("/transactions", methods=["GET"])
def get_transactions():
    """Get all transactions"""
    try:
        transactions = Transaction.query.all()
        return jsonify({
            "count": len(transactions),
            "transactions": [t.to_dict() for t in transactions]
        }), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to retrieve transactions",
            "details": str(e)
        }), 500


@main.route("/transactions/<int:id>", methods=["GET"])
def get_transaction(id):
    """Get a single transaction by ID"""
    try:
        transaction = Transaction.query.get(id)
        
        if not transaction:
            return jsonify({
                "error": "Transaction not found",
                "details": f"No transaction with ID {id}"
            }), 404
        
        return jsonify(transaction.to_dict()), 200
        
    except Exception as e:
        return jsonify({
            "error": "Failed to retrieve transaction",
            "details": str(e)
        }), 500


@main.route("/transactions/<int:id>", methods=["DELETE"])
def delete_transaction(id):
    """Delete a transaction by ID"""
    try:
        transaction = Transaction.query.get(id)
        
        if not transaction:
            return jsonify({
                "error": "Transaction not found",
                "details": f"No transaction with ID {id}"
            }), 404
        
        db.session.delete(transaction)
        db.session.commit()
        
        return jsonify({
            "message": "Transaction deleted successfully",
            "id": id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Failed to delete transaction",
            "details": str(e)
        }), 500


@main.route("/summary/<int:month>", methods=["GET"])
def monthly_summary(month):
    """Get monthly expense and income summary"""
    try:
        # Validate month
        if month < 1 or month > 12:
            return jsonify({
                "error": "Invalid month",
                "details": "Month must be between 1 and 12"
            }), 400
        
        # Get expenses
        expenses = Transaction.query.filter(
            Transaction.type == "expense",
            extract("month", Transaction.date) == month
        ).all()
        
        # Get income
        income = Transaction.query.filter(
            Transaction.type == "income",
            extract("month", Transaction.date) == month
        ).all()
        
        total_expenses = sum(t.amount for t in expenses)
        total_income = sum(t.amount for t in income)
        
        return jsonify({
            "month": month,
            "total_expenses": total_expenses,
            "total_income": total_income,
            "net": total_income - total_expenses,
            "expense_count": len(expenses),
            "income_count": len(income)
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": "Failed to generate summary",
            "details": str(e)
        }), 500