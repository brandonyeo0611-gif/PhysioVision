from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='auth-register'),
    path('login/',    views.LoginView.as_view(),    name='auth-login'),
    path('logout/',   views.LogoutView.as_view(),   name='auth-logout'),
    path('me/',       views.MeView.as_view(),       name='auth-me'),
    path(
        'wellness-screening/',
        views.WellnessScreeningView.as_view(),
        name='wellness-screening',
    ),
    path('agent/chat/', views.AgentChatView.as_view(), name='agent-chat'),
]
