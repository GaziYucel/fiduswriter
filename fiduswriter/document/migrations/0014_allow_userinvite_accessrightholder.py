# Generated by Django 3.1.4 on 2021-05-25 20:22

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('document', '0013_auto_20210406_0640'),
        ('user', '0006_userinvite'),
    ]

    operations = [
        migrations.AlterField(
            model_name='accessright',
            name='holder_type',
            field=models.ForeignKey(limit_choices_to=models.Q(models.Q(('app_label', 'user'), ('model', 'user')), models.Q(('app_label', 'user'), ('model', 'userinvite')), _connector='OR'), on_delete=django.db.models.deletion.CASCADE, to='contenttypes.contenttype'),
        ),
    ]